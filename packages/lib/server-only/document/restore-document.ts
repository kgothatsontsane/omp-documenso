import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type RestoreDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  requestMetadata: ApiRequestMetadata;
};

/**
 * Restores a soft-deleted document from trash.
 *
 * Uses the same visibility-aware authorization as deletion — only the owner,
 * a sufficiently privileged team member, or the team email can restore.
 */
export const restoreDocument = async ({ id, userId, teamId, requestMetadata }: RestoreDocumentOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: {
      ...envelopeWhereInput,
      deletedAt: { not: null },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  return await prisma.$transaction(async (tx) => {
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        envelopeId: envelope.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RESTORED,
        metadata: requestMetadata,
        data: {},
      }),
    });

    return await tx.envelope.update({
      where: {
        id: envelope.id,
      },
      data: {
        deletedAt: null,
      },
    });
  });
};
