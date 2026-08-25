import { promisify } from 'node:util';
import { recordTriggerUsage } from '@documenso/lib/server-only/trigger-usage/record-usage';
import { prisma } from '@documenso/prisma';
import { task } from '@trigger.dev/sdk';
import libreoffice from 'libreoffice-convert';

const convert = promisify(libreoffice.convert);

type DocxToPdfPayload = {
  documentDataId: string;
};

/**
 * Converts a DOCX document to a PDF using LibreOffice.
 *
 * The DOCX is stored as a DocumentData row (BYTES_64) by the caller, which
 * passes only its id — this sidesteps the 3MB trigger payload cap for large
 * documents. The PDF is written back as a new DocumentData row and its id is
 * returned, avoiding the 10MB output cap as well.
 *
 * LibreOffice is installed in the container via the aptGet build extension.
 */
export const docxToPdf = task({
  id: 'docx-to-pdf',
  machine: {
    preset: 'small-2x',
  },
  run: async (payload: DocxToPdfPayload, { ctx }) => {
    if (ctx.environment.type !== 'DEVELOPMENT') {
      process.env.LIBREOFFICE_PATH = '/usr/bin/libreoffice';
    }

    // LibreOffice/fontconfig need a writable home for their caches; the
    // container home may be read-only.
    process.env.HOME = '/tmp';
    process.env.XDG_CACHE_HOME = '/tmp/.cache';

    const inputData = await prisma.documentData.findUniqueOrThrow({
      where: { id: payload.documentDataId },
    });

    const inputBuffer = Buffer.from(inputData.data, 'base64');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer: Buffer = await convert(inputBuffer, '.pdf', undefined);

    const pdfData = await prisma.documentData.create({
      data: {
        type: 'BYTES_64',
        data: pdfBuffer.toString('base64'),
        initialData: pdfBuffer.toString('base64'),
      },
    });

    await recordTriggerUsage('docx-to-pdf', ctx.run.id);

    return {
      pdfDocumentDataId: pdfData.id,
      inputBytes: inputBuffer.byteLength,
      outputBytes: pdfBuffer.byteLength,
    };
  },
});
