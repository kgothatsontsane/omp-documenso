import type { JobRunIO } from '@documenso/lib/jobs/client/_internal/job';
import { task, tasks } from '@trigger.dev/sdk';

import { TRIGGER_JOB_ID } from '@documenso/lib/jobs/client/trigger';

type TriggerJobPayload = {
  id?: string;
  name: string;
  payload: unknown;
  timestamp?: number;
};

const io: JobRunIO = {
  logger: console,
  runTask: async (_cacheKey, callback) => callback(),
  triggerJob: async (_cacheKey, options) => tasks.trigger(TRIGGER_JOB_ID, options),
  wait: async (_cacheKey, ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export const jobs = task({
  id: TRIGGER_JOB_ID,
  run: async ({ name, payload }: TriggerJobPayload) => {
    const { jobDefinitions } = await import('@documenso/lib/jobs/definitions');
    const definition = jobDefinitions.find((candidate) => candidate.trigger.name === name);

    if (!definition) {
      throw new Error(`Unknown job: ${name}`);
    }

    const parsedPayload = definition.trigger.schema ? definition.trigger.schema.parse(payload) : payload;

    // The definition union's handler parameter is a single intersection; the
    // per-definition schema.parse above already validated the payload.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const handler = definition.handler as (options: { payload: unknown; io: JobRunIO }) => Promise<unknown>;

    await handler({ payload: parsedPayload, io });
  },
});
