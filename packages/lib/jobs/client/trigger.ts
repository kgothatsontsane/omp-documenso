import { tasks } from '@trigger.dev/sdk';

import type { JobDefinition, SimpleTriggerJobOptions } from './_internal/job';
import { BaseJobProvider } from './base';

export const TRIGGER_JOB_ID = 'documenso-job';

export class TriggerJobProvider extends BaseJobProvider {
  public defineJob<N extends string, T>(_job: JobDefinition<N, T>): void {}

  public getApiHandler() {
    return async () => new Response('Trigger.dev handles jobs externally', { status: 404 });
  }

  public async triggerJob(options: SimpleTriggerJobOptions): Promise<void> {
    await tasks.trigger(TRIGGER_JOB_ID, options);
  }
}
