import {
  NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER,
  NEXT_PUBLIC_SIGNING_CONTACT_INFO,
  NEXT_PUBLIC_WEBAPP_URL,
} from '@documenso/lib/constants/app';
import { env } from '@documenso/lib/utils/env';
import type { PDF, Signer } from '@libpdf/core';
import { match } from 'ts-pattern';

import { getTimestampAuthority } from './helpers/tsa';
import { createGoogleCloudSigner } from './transports/google-cloud';
import { createLocalSigner } from './transports/local';
import { signWithTrustedSignatures } from './transports/trusted-signatures';

export type SignOptions = {
  pdf: PDF;
};

let signer: Signer | null = null;

const getSigner = async () => {
  if (signer) {
    return signer;
  }

  const transport = env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local';

  // eslint-disable-next-line require-atomic-updates
  signer = await match(transport)
    .with('local', async () => await createLocalSigner())
    .with('gcloud-hsm', async () => await createGoogleCloudSigner())
    .otherwise(() => {
      throw new Error(`Unsupported signing transport: ${transport}`);
    });

  return signer;
};

export const signPdf = async ({ pdf }: SignOptions) => {
  const transport = env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local';

  // The Trusted Signatures transport signs at the raw byte level (it builds a
  // placeholder, sends the digest to the TS API, and splices the returned CMS
  // into the PDF). libpdf's Signer interface expects raw RSA signature bytes
  // and builds the CMS itself, so the two are incompatible — handle the TS
  // transport out-of-band rather than through pdf.sign({ signer }).
  if (transport === 'trusted-signatures') {
    const bytes = await pdf.save();

    return signWithTrustedSignatures({ pdf: Buffer.from(bytes) });
  }

  const signer = await getSigner();

  const tsa = getTimestampAuthority();

  const { bytes } = await pdf.sign({
    signer,
    reason: 'Signed by Documenso',
    location: NEXT_PUBLIC_WEBAPP_URL(),
    contactInfo: NEXT_PUBLIC_SIGNING_CONTACT_INFO(),
    subFilter: NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER() ? 'adbe.pkcs7.detached' : 'ETSI.CAdES.detached',
    timestampAuthority: tsa ?? undefined,
    longTermValidation: !!tsa,
    archivalTimestamp: !!tsa,
  });

  return bytes;
};
