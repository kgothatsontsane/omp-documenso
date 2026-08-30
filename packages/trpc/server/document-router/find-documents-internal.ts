import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getStats } from '@documenso/lib/server-only/document/get-stats';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { mapEnvelopesToDocumentMany } from '@documenso/lib/utils/document';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindDocumentsInternalRequestSchema,
  ZFindDocumentsInternalResponseSchema,
} from './find-documents-internal.types';

export const findDocumentsInternalRoute = authenticatedProcedure
  .input(ZFindDocumentsInternalRequestSchema)
  .output(ZFindDocumentsInternalResponseSchema)
  .query(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const {
      query,
      templateId,
      page,
      perPage,
      orderByDirection,
      orderByColumn,
      source,
      status,
      hasExpiredRecipients,
      period,
      senderIds,
      folderId,
    } = input;

    // Load the team once and share it — `getStats` and `findDocuments` both
    // deep-load the team (2+ Prisma statements each); previously that ran
    // twice per dashboard request.
    const team = teamId !== undefined ? await getTeamById({ userId: user.id, teamId }) : undefined;

    const [stats, documents] = await Promise.all([
      getStats({
        userId: user.id,
        teamId,
        period,
        search: query,
        folderId,
        senderIds,
        team,
      }),
      findDocuments({
        userId: user.id,
        teamId,
        query,
        templateId,
        page,
        perPage,
        source,
        status,
        period,
        senderIds,
        folderId,
        hasExpiredRecipients,
        orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
        team,
      }),
    ]);

    return {
      ...documents,
      data: documents.data.map((envelope) => mapEnvelopesToDocumentMany(envelope)),
      stats,
    };
  });
