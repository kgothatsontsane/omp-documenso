import { restoreDocument } from '@documenso/lib/server-only/document/restore-document';

import { ZGenericSuccessResponse } from '../schema';
import { authenticatedProcedure } from '../trpc';
import {
  restoreDocumentMeta,
  ZRestoreDocumentRequestSchema,
  ZRestoreDocumentResponseSchema,
} from './restore-document.types';

export const restoreDocumentRoute = authenticatedProcedure
  .meta(restoreDocumentMeta)
  .input(ZRestoreDocumentRequestSchema)
  .output(ZRestoreDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { documentId } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    await restoreDocument({
      id: {
        type: 'documentId',
        id: documentId,
      },
      userId: ctx.user.id,
      teamId,
      requestMetadata: ctx.metadata,
    });

    return ZGenericSuccessResponse;
  });
