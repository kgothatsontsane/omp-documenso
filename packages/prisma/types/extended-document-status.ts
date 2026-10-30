import { DocumentStatus } from '@prisma/client';

export const ExtendedDocumentStatus = {
  ...DocumentStatus,
  INBOX: 'INBOX',
  ALL: 'ALL',
  EXPIRED: 'EXPIRED',
  TRASH: 'TRASH',
} as const;

export type ExtendedDocumentStatus = (typeof ExtendedDocumentStatus)[keyof typeof ExtendedDocumentStatus];
