import { prisma } from '@documenso/prisma';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';

/**
 * Whether an email of the given type has already been sent to a recipient for
 * an envelope, based on the EMAIL_SENT audit log.
 *
 * Email jobs run on Trigger.dev with automatic retries. A retry after a
 * failure that occurred *after* `sendMail` (audit write, reminder update, a
 * later recipient in the loop) would otherwise re-send the same email — the
 * "duplicate email notification" bug. Checking this before sending makes the
 * handlers idempotent.
 *
 * ponytail: a failure exactly between `sendMail` and the audit write can still
 * double-send; if that recurs, switch to writing a marker row before sending.
 */
export const hasEmailBeenSent = async (envelopeId: string, recipientId: number, emailType: string) => {
  const log = await prisma.documentAuditLog.findFirst({
    where: {
      envelopeId,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      data: {
        path: ['recipientId'],
        equals: recipientId,
      },
    },
    select: {
      data: true,
    },
  });

  const data = log?.data as Record<string, unknown> | null | undefined;

  return Boolean(data && data.emailType === emailType);
};
