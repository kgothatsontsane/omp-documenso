import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const restoreDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/restore',
    summary: 'Restore document',
    description:
      'Restores a soft-deleted document from trash. The caller must be able to see the document (owner, privileged team member, or team email).',
    tags: ['Document'],
  },
};

export const ZRestoreDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZRestoreDocumentResponseSchema = ZSuccessResponseSchema;

export type TRestoreDocumentRequest = z.infer<typeof ZRestoreDocumentRequestSchema>;
export type TRestoreDocumentResponse = z.infer<typeof ZRestoreDocumentResponseSchema>;
