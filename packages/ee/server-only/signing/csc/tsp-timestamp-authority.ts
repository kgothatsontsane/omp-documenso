import { NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY_TIMEOUT_MS } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { DigestAlgorithm, TimestampAuthority } from '@libpdf/core';

import { hashOidForDigest } from './algorithm-resolver';
import { joinCscUrl } from './client/http';
import { cscTimestamp } from './client/signatures';
import type { CscTransport } from './transport';

/**
 * libpdf {@link TimestampAuthority} backed by the CSC TSP's
 * `signatures/timestamp` endpoint (§11.10).
 *
 * Used only at sign time, per recipient, when {@link resolveCscSignTimeTsa}
 * selects the TSP source — that is, when the TSP advertises
 * `signatures/timestamp` in `info.methods`. The token wired in is the
 * current recipient's own service-scope bearer (the same one authorising
 * the `signatures/signHash` call alongside it), so the timestamp gets
 * attributed to the same identity that just authorised the signature.
 *
 * Seal-time archival timestamps do not use this class — they go through
 * the env-only path in `finalize-tsp-completion.ts`.
 *
 * Failure semantics: a single `signatures/timestamp` call. On any error
 * (HTTP, schema, expired token) we surface `CSC_PROVIDER_NO_TSA` with the
 * upstream message folded in. There's no try-in-order — at sign time the
 * recipient is fixed, so there's no other token to fall through to.
 */

type CscTspTimestampAuthorityOptions = {
  transport: CscTransport;
  /** Decrypted service-scope access token for the current recipient. */
  serviceToken: string;
  /** Optional deadline for the `signatures/timestamp` call. */
  signal?: AbortSignal;
};

export class CscTspTimestampAuthority implements TimestampAuthority {
  private readonly transport: CscTransport;

  private readonly serviceToken: string;

  private readonly signal?: AbortSignal;

  constructor(opts: CscTspTimestampAuthorityOptions) {
    this.transport = opts.transport;
    this.serviceToken = opts.serviceToken;
    this.signal = opts.signal;
  }

  /**
   * Request a CSC §11.10 timestamp for the supplied digest, authorised with
   * the recipient's service-scope bearer. Returns the decoded TimeStampToken
   * bytes. Throws `CSC_PROVIDER_NO_TSA` carrying the upstream error message
   * on failure.
   *
   * `algorithm` is libpdf's `DigestAlgorithm` (`SHA-256` / `SHA-384` /
   * `SHA-512`), translated to the matching `hashAlgo` OID via the existing
   * {@link hashOidForDigest} mapping so the spec's OID-typed payload stays
   * in one place.
   */
  async timestamp(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    const hash = Buffer.from(digest).toString('base64');
    const hashAlgo = hashOidForDigest(algorithm);

    try {
      const response = await cscTimestamp({
        baseUrl: this.transport.serviceBaseUrl,
        accessToken: this.serviceToken,
        hash,
        hashAlgo,
        signal: this.signal,
      });

      return Buffer.from(response.timestamp, 'base64');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
        message: `CSC TSP timestamp endpoint refused the recipient's service token: ${message}.`,
      });
    }
  }
}

/**
 * libpdf {@link TimestampAuthority} backed by the CSC TSP's
 * `signatures/timestamp` endpoint (§11.10) for the **seal-time** B-LTA
 * archival stamp.
 *
 * Unlike sign time, seal time has no recipient context to carry a
 * service-scope bearer — the `seal-document` job runs after every recipient
 * signed. We mint a service-scope token via the OAuth2 client-credentials
 * grant using the operator's client credentials (Basic auth against the TSP's
 * `oauth2/token` endpoint). arctic 3.7 does not expose client_credentials,
 * so the grant is performed with a direct `fetch`. If the TSP rejects the
 * grant (common — CSC service scope is normally authorization-code based),
 * the caller ({@link resolveCscSealTimeTsa}) falls back to the env-configured
 * RFC 3161 TSA. The token is fetched once, up-front, and reused for every
 * envelope item in the seal batch.
 *
 * Failure semantics mirror {@link CscTspTimestampAuthority}: a single
 * `signatures/timestamp` call; on error we surface `CSC_PROVIDER_NO_TSA`
 * with the upstream message folded in.
 */

export const createCscTspSealTimeTimestampAuthority = async (
  transport: CscTransport,
): Promise<TimestampAuthority> => {
  const accessToken = await acquireOperatorServiceToken(transport);

  const signal = AbortSignal.timeout(NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY_TIMEOUT_MS());

  return {
    async timestamp(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
      const hash = Buffer.from(digest).toString('base64');
      const hashAlgo = hashOidForDigest(algorithm);

      try {
        const response = await cscTimestamp({
          baseUrl: transport.serviceBaseUrl,
          accessToken,
          hash,
          hashAlgo,
          signal,
        });

        return Buffer.from(response.timestamp, 'base64');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
          message: `CSC TSP seal-time timestamp endpoint refused the operator service token: ${message}.`,
        });
      }
    },
  };
};

const acquireOperatorServiceToken = async (transport: CscTransport): Promise<string> => {
  const tokenEndpoint = joinCscUrl({ baseUrl: transport.oauthBaseUrl, path: 'oauth2/token' });

  const basicAuth = Buffer.from(`${transport.clientId}:${transport.clientSecret}`).toString('base64');

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'service' }),
    signal: AbortSignal.timeout(NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY_TIMEOUT_MS()),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');

    throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
      message: `CSC TSP client_credentials grant rejected (HTTP ${response.status}): ${text.slice(0, 200)}`,
    });
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
      message: 'CSC TSP client_credentials grant returned no access_token.',
    });
  }

  return data.access_token;
};
