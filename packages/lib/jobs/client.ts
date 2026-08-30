import { JobClient } from './client/client';
import { jobDefinitions } from './definitions';

/**
 * The `as const` assertion is load bearing as it provides the correct level of type inference for
 * triggering jobs.
 */
export const jobsClient = new JobClient(jobDefinitions);

export const jobs = jobsClient;
