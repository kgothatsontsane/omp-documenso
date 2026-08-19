import { AppError } from '@documenso/lib/errors/app-error';
import type { Logger } from 'pino';

import {
  DOCUMENT_CONVERSION_MIME_TYPE_DOCX,
  IS_DOCUMENT_CONVERSION_ENABLED,
} from '../../constants/document-conversion';
import { isCircuitOpen, recordFailure, recordSuccess } from './circuit-breaker';
import { convertDocxToPdfViaConvertApi, isConvertApiConfigured } from './convertapi';
import { convertDocxToPdfViaGotenberg } from './gotenberg';

type ConvertDocxToPdfOptions = {
  buffer: Buffer;
  filename: string;
};

/**
 * Converts a DOCX buffer to a PDF buffer via the configured Gotenberg
 * conversion service, with a fallback to ConvertAPI.
 * Guards on feature-enabled and circuit-open state,
 * and emits a structured log line for each attempt.
 */
export const convertDocxToPdf = async (
  { buffer, filename }: ConvertDocxToPdfOptions,
  logger?: Logger,
): Promise<Buffer> => {
  if (!IS_DOCUMENT_CONVERSION_ENABLED()) {
    throw new AppError('CONVERSION_SERVICE_UNAVAILABLE', {
      message: 'Conversion service not configured',
      userMessage: "Document conversion isn't enabled on this instance. Please upload a PDF.",
      statusCode: 503,
    });
  }

  if (isCircuitOpen()) {
    throw new AppError('CONVERSION_SERVICE_UNAVAILABLE', {
      message: 'Conversion circuit is open; failing fast',
      userMessage: 'Document conversion is temporarily unavailable. Please try again shortly or upload a PDF.',
      statusCode: 503,
    });
  }

  const startedAt = Date.now();

  try {
    const outputBuffer = await convertDocxToPdfViaGotenberg({ buffer, filename });

    recordSuccess();

    logger?.info({
      event: 'document_conversion_attempt',
      filename,
      sourceMimeType: DOCUMENT_CONVERSION_MIME_TYPE_DOCX,
      durationMs: Date.now() - startedAt,
      inputBytes: buffer.byteLength,
      outputBytes: outputBuffer.byteLength,
    });

    return outputBuffer;
  } catch (err) {
    recordFailure();

    // Try fallback to ConvertAPI if Gotenberg fails
    if (isConvertApiConfigured()) {
      logger?.info({
        event: 'document_conversion_fallback',
        filename,
        reason: err instanceof Error ? err.message : String(err),
      });

      try {
        const outputBuffer = await convertDocxToPdfViaConvertApi({ buffer, filename });

        recordSuccess();

        logger?.info({
          event: 'document_conversion_attempt',
          filename,
          sourceMimeType: DOCUMENT_CONVERSION_MIME_TYPE_DOCX,
          durationMs: Date.now() - startedAt,
          inputBytes: buffer.byteLength,
          outputBytes: outputBuffer.byteLength,
          fallback: true,
        });

        return outputBuffer;
      } catch (fallbackErr) {
        recordFailure();

        const errMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        const errCode = fallbackErr instanceof AppError ? fallbackErr.code : 'UNKNOWN';

        const logData = {
          event: 'document_conversion_attempt',
          filename,
          sourceMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          durationMs: Date.now() - startedAt,
          inputBytes: buffer.byteLength,
          failed: true,
          errorCode: errCode,
          error: errMessage,
        };

        if (errCode === 'CONVERSION_FAILED') {
          logger?.error(logData);
        } else {
          logger?.info(logData);
        }

        throw fallbackErr;
      }
    }

    const errMessage = err instanceof Error ? err.message : String(err);
    const errCode = err instanceof AppError ? err.code : 'UNKNOWN';

    const logData = {
      event: 'document_conversion_attempt',
      filename,
      sourceMimeType: DOCUMENT_CONVERSION_MIME_TYPE_DOCX,
      durationMs: Date.now() - startedAt,
      inputBytes: buffer.byteLength,
      failed: true,
      errorCode: errCode,
      error: errMessage,
    };

    if (errCode === 'CONVERSION_FAILED') {
      logger?.error(logData);
    } else {
      logger?.info(logData);
    }

    throw err;
  }
};
