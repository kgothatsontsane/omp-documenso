import type { JobRunIO } from '@documenso/lib/jobs/client/_internal/job';
import { run as alertOrganisationSeatDrift } from '@documenso/lib/jobs/definitions/internal/alert-organisation-seat-drift.handler';
import { run as cleanupRateLimits } from '@documenso/lib/jobs/definitions/internal/cleanup-rate-limits.handler';
import { run as expireRecipientsSweep } from '@documenso/lib/jobs/definitions/internal/expire-recipients-sweep.handler';
import { run as sealDocumentSweep } from '@documenso/lib/jobs/definitions/internal/seal-document-sweep.handler';
import { run as sendSigningRemindersSweep } from '@documenso/lib/jobs/definitions/internal/send-signing-reminders-sweep.handler';
import { run as syncEmailDomains } from '@documenso/lib/jobs/definitions/internal/sync-email-domains.handler';
import { migrateDeletedAccountServiceAccount } from '@documenso/lib/server-only/user/service-accounts/deleted-account';
import { migrateLegacyServiceAccount } from '@documenso/lib/server-only/user/service-accounts/legacy-service-account';
import { schedules } from '@trigger.dev/sdk';

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

const runs = [
  ['Seal Document Sweep', sealDocumentSweep],
  ['Expire Recipients Sweep', expireRecipientsSweep],
  ['Send Signing Reminders Sweep', sendSigningRemindersSweep],
  ['Cleanup Rate Limits', cleanupRateLimits],
  ['Sync Email Domains', syncEmailDomains],
  ['Alert Organisation Seat Drift', alertOrganisationSeatDrift],
] as const;

export const sweeps = schedules.task({
  id: 'documenso-sweeps',
  cron: {
    pattern: '0,15,30,45 * * * *',
    timezone: 'Africa/Johannesburg',
  },
  run: async () => {
    const results: Record<string, string> = {};

    for (const [name, run] of runs) {
      try {
        await run({ payload: {}, io });
        results[name] = 'ok';
      } catch (err) {
        results[name] = `FAIL: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[cron] ${name} failed:`, err);
      }
    }

    try {
      await migrateDeletedAccountServiceAccount();
      await migrateLegacyServiceAccount();
      results['service-account-migrations'] = 'ok';
    } catch (err) {
      results['service-account-migrations'] = `FAIL: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[cron] service account migration failed:', err);
    }

    return results;
  },
});
