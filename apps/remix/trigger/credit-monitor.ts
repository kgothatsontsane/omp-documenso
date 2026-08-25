import { mailer } from '@documenso/email/mailer';
import { DOCUMENSO_INTERNAL_EMAIL } from '@documenso/lib/constants/email';
import { prisma } from '@documenso/prisma';
import { schedules } from '@trigger.dev/sdk';

// The trigger.dev free plan grants $5 of monthly compute credits.
const MONTHLY_CREDIT_CENTS = Number(process.env.TRIGGER_MONTHLY_CREDIT_CENTS ?? 500);
// Alert when remaining credits drop below this.
const ALERT_THRESHOLD_CENTS = Number(process.env.TRIGGER_ALERT_THRESHOLD_CENTS ?? 100);

const monthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

/**
 * Sums the current month's recorded trigger.dev usage and emails all admins
 * when remaining credits are about to run out, so the sweeps and the
 * LibreOffice conversion task can be reviewed before the free plan hard-stops
 * all runs.
 */
export const creditMonitor = schedules.task({
  id: 'documenso-credit-monitor',
  cron: {
    pattern: '0 8 * * *',
    timezone: 'Africa/Johannesburg',
  },
  run: async () => {
    const aggregate = await prisma.triggerUsageRecord.aggregate({
      _sum: { costInCents: true },
      _count: { _all: true },
      where: { createdAt: { gte: monthStart() } },
    });

    const usedCents = aggregate._sum.costInCents ?? 0;
    const remainingCents = Math.max(0, MONTHLY_CREDIT_CENTS - usedCents);
    const runCount = aggregate._count._all;

    if (remainingCents <= ALERT_THRESHOLD_CENTS) {
      const admins = await prisma.user.findMany({
        where: { roles: { has: 'ADMIN' } },
        select: { email: true, name: true },
      });

      if (admins.length > 0) {
        await mailer.sendMail({
          to: admins.map((admin) => ({ address: admin.email, name: admin.name || '' })),
          from: DOCUMENSO_INTERNAL_EMAIL,
          subject: 'trigger.dev credit balance is running low',
          text: `Your trigger.dev monthly credits are nearly exhausted.

Used this month: $${(usedCents / 100).toFixed(2)}
Remaining: $${(remainingCents / 100).toFixed(2)}
Runs this month: ${runCount}

Once the free-plan credit allowance is used up, all tasks (including the
document sweeps and the DOCX conversion task) will be hard-stopped until the
next billing period. Review the admin observability page for usage details.`,
        });
      }
    }

    return {
      usedCents,
      remainingCents,
      runCount,
      month: monthStart().toISOString(),
    };
  },
});
