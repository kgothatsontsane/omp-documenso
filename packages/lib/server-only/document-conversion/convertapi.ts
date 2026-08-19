import { DOCUMENT_CONVERSION_MIME_TYPE_DOCX } from '../../constants/document-conversion';

type ConvertDocxToPdfViaApiOptions = {
  buffer: Buffer;
  filename: string;
};

const CONVERT_API_BASE_URL = 'https://v2.convertapi.com';
const CONVERT_API_ENDPOINT = '/convert/docx/to/pdf';

export const isConvertApiConfigured = (): boolean => {
  return !!process.env.CONVERT_API_SECRET;
};

const getConvertApiAuth = (): { secret: string } | undefined => {
  const secret = process.env.CONVERT_API_SECRET;

  if (!secret) {
    return undefined;
  }

  return { secret };
};

export const convertDocxToPdfViaConvertApi = async ({
  buffer,
  filename,
}: ConvertDocxToPdfViaApiOptions): Promise<Buffer> => {
  const auth = getConvertApiAuth();

  if (!auth) {
    throw new Error('ConvertAPI secret not configured');
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: DOCUMENT_CONVERSION_MIME_TYPE_DOCX,
  });

  formData.append('File', blob, filename);
  formData.append('StoreFile', 'false');

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(
      `${CONVERT_API_BASE_URL}${CONVERT_API_ENDPOINT}?Secret=${encodeURIComponent(auth.secret)}`,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      let body = '';

      try {
        body = await response.text();
      } catch {
        body = '';
      }

      throw new Error(`ConvertAPI returned ${response.status}: ${body.slice(0, 500)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    clearTimeout(timeoutHandle);
    return Buffer.from(arrayBuffer);
  } catch (err) {
    clearTimeout(timeoutHandle);

    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Conversion timed out');
    }

    throw err;
  }
};
