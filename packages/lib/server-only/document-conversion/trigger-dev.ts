import { prisma } from '@documenso/prisma';
import { runs, tasks } from '@trigger.dev/sdk';

import { getFileServerSide } from '../../universal/upload/get-file.server';
import { createDocumentData } from '../document-data/create-document-data';

type ConvertDocxToPdfViaTriggerDevOptions = {
  buffer: Buffer;
  filename: string;
};

export const isTriggerDevConversionConfigured = (): boolean => {
  return !!process.env.TRIGGER_SECRET_KEY;
};

/**
 * Converts a DOCX buffer to a PDF via the trigger.dev LibreOffice task.
 *
 * The DOCX is written to a DocumentData row (BYTES_64) so only its id crosses
 * the trigger payload boundary, then the task writes the PDF to a new
 * DocumentData row and returns its id. Both temp rows are cleaned up here.
 */
export const convertDocxToPdfViaTriggerDev = async ({
  buffer,
  filename,
}: ConvertDocxToPdfViaTriggerDevOptions): Promise<Buffer> => {
  if (!isTriggerDevConversionConfigured()) {
    throw new Error('trigger.dev conversion is not configured');
  }

  const inputDocumentData = await createDocumentData({
    type: 'BYTES_64',
    data: buffer.toString('base64'),
  });

  try {
    const handle = await tasks.trigger('docx-to-pdf', {
      documentDataId: inputDocumentData.id,
    });

    const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });

    if (run.isCompleted && run.status === 'COMPLETED' && run.output?.pdfDocumentDataId) {
      const pdfDocumentData = await prisma.documentData.findUniqueOrThrow({
        where: { id: run.output.pdfDocumentDataId },
      });

      try {
        return Buffer.from(await getFileServerSide(pdfDocumentData));
      } finally {
        await prisma.documentData.deleteMany({ where: { id: pdfDocumentData.id } });
      }
    }

    throw new Error(`Conversion task failed: ${run.status} ${run.error?.message ?? ''}`.trim());
  } finally {
    // Clean up the temp DOCX row.
    await prisma.documentData.deleteMany({ where: { id: inputDocumentData.id } });
  }
};
