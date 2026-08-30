import {
  NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY,
  NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY_TIMEOUT_MS,
} from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { HttpTimestampAuthority, type TimestampAuthority } from '@libpdf/core';

import { getCscTransport, type CscTransport } from './transport';
import { CscTspTimestampAuthority } from './tsp-timestamp-authority';
import { createCscTspSealTimeTimestampAuthority } from './tsp-timestamp-authority';

/**
 * Two-phase TSA resolution for the CSC transport.
 *
 * Phase 1 — sign time (PAdES B-T, per recipient signature).
 *   Each recipient's CMS gets a signature timestamp embedded as an unsigned
 *   attribute. {@link resolveCscSignTimeTsa} returns a libpdf-shaped
 *   `TimestampAuthority` bound to either the TSP's `signatures/timestamp`
 *   endpoint (authorised with the recipient's own service-scope bearer) or
 *   the operator's env-configured RFC 3161 TSA, whichever is configured.
 *   TSP wins precedence so a TSP-supplied TSA is the default when the TSP
 *   advertises the method.
 *
 * Phase 2 — seal time (PAdES B-LTA archival timestamp).
 *   The seal-document job emits one `/DocTimeStamp` over the fully-signed
 *   envelope. {@link resolveCscSealTimeTsa} prefers the TSP's own
 *   `signatures/timestamp` endpoint (so the archival anchor is minted by the
 *   same TSP that signed the document) and falls back to the env-configured
 *   RFC 3161 TSA — the recommended dedicated qualified archival anchor,
 *   independent of the per-recipient TSP.
 *
 * Boot-time guard: {@link buildCscTransport} asserts
 * `NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY` is set unconditionally — seal
 * time always needs it, so making it env-or-fail at boot also satisfies
 * the sign-time fallback. The defensive throws inside the resolvers below
 * should be unreachable in practice.
 */

/**
 * Build a libpdf `TimestampAuthority` for a recipient's B-T sign-time
 * signature timestamp.
 *
 * Precedence: TSP first, env fallback. Selection is made up-front based on
 * the boot-discovered transport capability — we don't try TSP then fall
 * through to env on a runtime error. If the chosen source fails at call
 * time, the recipient's sign attempt fails (operator's recourse is to
 * configure env, which then wins on the next sign).
 *
 * `serviceToken` is the decrypted, non-expired service-scope bearer for
 * the current recipient — used only when the TSP source is selected.
 */
export const resolveCscSignTimeTsa = (transport: CscTransport, serviceToken: string): TimestampAuthority => {
  if (transport.supportsTimestamp) {
    return new CscTspTimestampAuthority({ transport, serviceToken });
  }

  const envUrls = parseTsaEnv(NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY());

  if (envUrls.length > 0) {
    return new HttpTimestampAuthority(envUrls[0], {
      timeout: NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY_TIMEOUT_MS(),
    });
  }

  // Boot-time guard in `buildCscTransport` should have rejected this
  // configuration before any recipient hit this code path.
  throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
    message:
      'CSC sign-time TSA unresolved: TSP does not advertise signatures/timestamp and NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY is unset. This should have been caught by the boot-time guard in buildCscTransport.',
  });
};

/**
 * Resolve the seal-time B-LTA archival `TimestampAuthority`.
 *
 * Precedence (resolved lazily at seal time):
 *  1. TSP's own `signatures/timestamp` endpoint (CSC §11.10) when advertised
 *     — the archival stamp then runs entirely through the TSP, no separate
 *     RFC 3161 TSA required. Seal time has no recipient, so a service-scope
 *     token is minted via the client-credentials grant
 *     ({@link createCscTspSealTimeTimestampAuthority}).
 *  2. Env-configured RFC 3161 TSA
 *     (`NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY`) — the recommended
 *     dedicated qualified archival anchor, independent of the TSP.
 *
 * If the TSP advertises the method but rejects the client-credentials grant
 * at runtime, we silently fall through to the env TSA so the seal still
 * completes. If neither source is available the boot guard in
 * `buildCscTransport` already rejected the configuration.
 */
export const resolveCscSealTimeTsa = async (): Promise<TimestampAuthority> => {
  const transport = await getCscTransport();

  if (transport.supportsTimestamp) {
    try {
      return await createCscTspSealTimeTimestampAuthority(transport);
    } catch (err) {
      // TSP path unavailable (e.g. client_credentials rejected) — fall
      // through to the env-configured TSA.
    }
  }

  if (isEnvTsaConfigured()) {
    const envUrls = parseTsaEnv(NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY());

    return new HttpTimestampAuthority(envUrls[0], {
      timeout: NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY_TIMEOUT_MS(),
    });
  }

  throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
    message:
      'CSC seal-time archival timestamps require either a TSP that advertises signatures/timestamp (with client-credentials support) or NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY.',
  });
};

/**
 * Cheap boot-time predicate — used by `buildCscTransport` to decide
 * whether the env TSA satisfies the "at least one source must be
 * configured" invariant. Keeping the env parsing in one place avoids
 * drift between the guard and the resolvers.
 */
export const isEnvTsaConfigured = (): boolean => {
  return parseTsaEnv(NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY()).length > 0;
};

const parseTsaEnv = (raw: string | undefined): string[] => {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
};
