import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import type { Logger } from 'pino';

import {
  DOCUMENT_CONVERSION_MIME_TYPE_DOCX,
  IS_DOCUMENT_CONVERSION_ENABLED,
} from '../../constants/document-conversion';
import { convertDocxToPdfViaTriggerDev, isTriggerDevConversionConfigured } from './trigger-dev';

type ConvertDocxToPdfOptions = {
  buffer: Buffer;
  filename: string;
};

type LogConversionOptions = {
  success: boolean;
  transport: 'triggerdev';
  durationMs: number;
  inputBytes: number;
  outputBytes?: number;
  errorCode?: string;
  errorMessage?: string;
};

const logConversion = async ({
  success,
  transport,
  durationMs,
  inputBytes,
  outputBytes,
  errorCode,
  errorMessage,
}: LogConversionOptions): Promise<void> => {
  try {
    await prisma.documentConversionLog.create({
      data: {
        success,
        transport,
        durationMs,
        inputBytes,
        outputBytes,
        errorCode,
        errorMessage,
      },
    });
  } catch {
    // Never let observability break a conversion.
  }
};

const logAttempt = (logger: Logger | undefined, data: Record<string, unknown>) => {
  if (data.errorCode === 'CONVERSION_FAILED') {
    logger?.error({
      event: 'document_conversion_attempt',
      ...data,
    });
  } else {
    logger?.info({
      event: 'document_conversion_attempt',
      ...data,
    });
  }
};

/**
 * Converts a DOCX buffer to a PDF buffer via the trigger.dev LibreOffice task.
 * Guards on feature-enabled state, and emits a structured log line plus a
 * persistent conversion-log row for each attempt.
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

  if (!isTriggerDevConversionConfigured()) {
    throw new AppError('CONVERSION_SERVICE_UNAVAILABLE', {
      message: 'trigger.dev conversion is not configured',
      userMessage: "Document conversion isn't enabled on this instance. Please upload a PDF.",
      statusCode: 503,
    });
  }

  const startedAt = Date.now();

  try {
    const outputBuffer = await convertDocxToPdfViaTriggerDev({ buffer, filename });

    logAttempt(logger, {
      filename,
      sourceMimeType: DOCUMENT_CONVERSION_MIME_TYPE_DOCX,
      durationMs: Date.now() - startedAt,
      inputBytes: buffer.byteLength,
      outputBytes: outputBuffer.byteLength,
      transport: 'triggerdev',
    });

    await logConversion({
      success: true,
      transport: 'triggerdev',
      durationMs: Date.now() - startedAt,
      inputBytes: buffer.byteLength,
      outputBytes: outputBuffer.byteLength,
    });

    return outputBuffer;
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const errCode = err instanceof AppError ? err.code : 'UNKNOWN';

    logAttempt(logger, {
      filename,
      sourceMimeType: DOCUMENT_CONVERSION_MIME_TYPE_DOCX,
      durationMs: Date.now() - startedAt,
      inputBytes: buffer.byteLength,
      failed: true,
      errorCode: errCode,
      error: errMessage,
    });

    await logConversion({
      success: false,
      transport: 'triggerdev',
      durationMs: Date.now() - startedAt,
      inputBytes: buffer.byteLength,
      errorCode: errCode,
      errorMessage: errMessage,
    });

    throw err;
  }
};
