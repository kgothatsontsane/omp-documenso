import { env } from '@documenso/lib/utils/env';

export const DOCUMENT_CONVERSION_MIME_TYPE_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Returns whether the document conversion feature is enabled.
 *
 * Platform-aware:
 * - On the server, checks the trigger.dev secret key is configured.
 * - On the client, reads the derived public flag injected via `window.__ENV__`.
 */
export const IS_DOCUMENT_CONVERSION_ENABLED = (): boolean => {
  if (typeof window === 'undefined') {
    return !!env('TRIGGER_SECRET_KEY');
  }

  return env('NEXT_PUBLIC_DOCUMENT_CONVERSION_ENABLED') === 'true';
};

/**
 * Returns the mime type -> extensions map that should be passed to the
 * dropzone `accept` config and used for server-side validation.
 *
 * Always includes PDF; only includes DOCX when the conversion feature is
 * enabled.
 */
export const getAllowedUploadMimeTypes = (): Record<string, string[]> => {
  const base: Record<string, string[]> = {
    'application/pdf': ['.pdf'],
  };

  if (IS_DOCUMENT_CONVERSION_ENABLED()) {
    base[DOCUMENT_CONVERSION_MIME_TYPE_DOCX] = ['.docx'];
  }

  return base;
};
