import { prisma } from '@documenso/prisma';

const monthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

/**
 * Returns document-conversion observability data: today's and this month's
 * attempt/failure counts and success rate, plus the most recent failures and
 * the current month's trigger.dev credit usage.
 */
export const getConversionObservability = async () => {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [today, month, recentFailures, usage] = await Promise.all([
    prisma.documentConversionLog.groupBy({
      by: ['success'],
      _count: { _all: true },
      _avg: { durationMs: true },
      where: { createdAt: { gte: dayStart } },
    }),
    prisma.documentConversionLog.groupBy({
      by: ['success'],
      _count: { _all: true },
      where: { createdAt: { gte: monthStart() } },
    }),
    prisma.documentConversionLog.findMany({
      where: { success: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.triggerUsageRecord.aggregate({
      _sum: { costInCents: true },
      _count: { _all: true },
      where: { createdAt: { gte: monthStart() } },
    }),
  ]);

  const MONTHLY_CREDIT_CENTS = Number(process.env.TRIGGER_MONTHLY_CREDIT_CENTS ?? 500);

  const usedCents = usage._sum.costInCents ?? 0;

  return {
    today: {
      attempts: today.reduce((sum, row) => sum + row._count._all, 0),
      failures: today.find((row) => row.success === false)?._count._all ?? 0,
      avgDurationMs: today.reduce((sum, row) => sum + (row._avg.durationMs ?? 0), 0) / Math.max(today.length, 1),
    },
    month: {
      attempts: month.reduce((sum, row) => sum + row._count._all, 0),
      failures: month.find((row) => row.success === false)?._count._all ?? 0,
    },
    recentFailures,
    credit: {
      usedCents,
      remainingCents: Math.max(0, MONTHLY_CREDIT_CENTS - usedCents),
      monthlyCreditCents: MONTHLY_CREDIT_CENTS,
      runs: usage._count._all,
    },
  };
};
