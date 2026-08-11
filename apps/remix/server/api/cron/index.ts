import type { JobRunIO } from '@documenso/lib/jobs/client/_internal/job';
import { ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION } from '@documenso/lib/jobs/definitions/internal/alert-organisation-seat-drift';
import { CLEANUP_RATE_LIMITS_JOB_DEFINITION } from '@documenso/lib/jobs/definitions/internal/cleanup-rate-limits';
import { EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION } from '@documenso/lib/jobs/definitions/internal/expire-recipients-sweep';
import { SEAL_DOCUMENT_SWEEP_JOB_DEFINITION } from '@documenso/lib/jobs/definitions/internal/seal-document-sweep';
import { SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION } from '@documenso/lib/jobs/definitions/internal/send-signing-reminders-sweep';
import { SYNC_EMAIL_DOMAINS_JOB_DEFINITION } from '@documenso/lib/jobs/definitions/internal/sync-email-domains';
import { migrateDeletedAccountServiceAccount } from '@documenso/lib/server-only/user/service-accounts/deleted-account';
import { migrateLegacyServiceAccount } from '@documenso/lib/server-only/user/service-accounts/legacy-service-account';
import { env } from '@documenso/lib/utils/env';
import type { Context } from 'hono';

const io: JobRunIO = {
  logger: {
    info: (...args) => console.log('[cron]', ...args),
    error: (...args) => console.error('[cron]', ...args),
    warn: (...args) => console.warn('[cron]', ...args),
    debug: (...args) => console.debug('[cron]', ...args),
    log: (...args) => console.log('[cron]', ...args),
  },
  runTask: async (_cacheKey, callback) => callback(),
  triggerJob: async () => {},
  wait: async () => {},
};

const defs = [
  SEAL_DOCUMENT_SWEEP_JOB_DEFINITION,
  EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION,
  SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION,
  CLEANUP_RATE_LIMITS_JOB_DEFINITION,
  SYNC_EMAIL_DOMAINS_JOB_DEFINITION,
  ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION,
] as const;

export const cronHandler = async (c: Context) => {
  const token = c.req.query('token');
  const authHeader = c.req.header('authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token !== env('CRON_SECRET') && headerToken !== env('CRON_SECRET')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    for (const def of defs) {
      try {
        await def.handler({ payload: {}, io });
      } catch (err) {
        console.error(`[cron] ${def.name} failed:`, err);
      }
    }

    await migrateDeletedAccountServiceAccount();
    await migrateLegacyServiceAccount();

    return c.json({ ok: true });
  } catch (err) {
    console.error('[cron] sweeps failed:', err);
    return c.json({ error: 'Internal error' }, 500);
  }
};
