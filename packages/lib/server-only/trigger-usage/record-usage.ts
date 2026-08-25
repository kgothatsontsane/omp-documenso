import { prisma } from '@documenso/prisma';
import { usage } from '@trigger.dev/sdk';

/**
 * Records the current task run's accumulated cost into TriggerUsageRecord so
 * the credit monitor can sum it without depending on trigger.dev's query API
 * (the free plan only retains one day of queryable runs).
 *
 * Never throws — usage accounting must not break task execution.
 */
export const recordTriggerUsage = async (taskId: string, runId?: string, durationMs?: number): Promise<void> => {
  try {
    const current = usage.getCurrent();

    await prisma.triggerUsageRecord.create({
      data: {
        taskId,
        runId,
        costInCents: current.totalCostInCents,
        durationMs,
      },
    });
  } catch (err) {
    console.error('[trigger-usage] failed to record usage:', err);
  }
};
