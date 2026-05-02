import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobRow extends QueryResultRow {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lockedAt: string | null;
  lockedBy: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimJobsOptions {
  jobType: string;
  workerId: string;
  limit: number;
}

@Injectable()
export class JobQueueService {
  constructor(private readonly database: DatabaseService) {}

  async claimJobs(options: ClaimJobsOptions) {
    if (options.limit <= 0) {
      return [];
    }

    const result = await this.database.query<JobRow>(buildClaimJobsSql(), [options.jobType, Math.floor(options.limit), options.workerId]);
    return result.rows;
  }

  async markSucceeded(client: PoolClient, jobId: string) {
    await client.query(
      `UPDATE jobs
          SET status = 'succeeded', locked_at = NULL, locked_by = NULL, error_message = NULL, updated_at = now()
        WHERE id = $1`,
      [jobId],
    );
  }

  async markFailed(client: PoolClient, job: Pick<JobRow, 'id' | 'attempts' | 'maxAttempts'>, errorMessage: string, retryDelaySeconds: number) {
    const willRetry = job.attempts < job.maxAttempts;
    await client.query(
      `UPDATE jobs
          SET status = $2,
              run_after = CASE WHEN $2 = 'queued' THEN now() + ($3::int * interval '1 second') ELSE run_after END,
              locked_at = NULL,
              locked_by = NULL,
              error_message = $4,
              updated_at = now()
        WHERE id = $1`,
      [job.id, willRetry ? 'queued' : 'failed', retryDelaySeconds, errorMessage],
    );
  }

  async releaseStaleRunningJobs(jobType: string, lockTimeoutSeconds: number) {
    const result = await this.database.query<{ id: string }>(
      `UPDATE jobs
          SET status = 'queued', locked_at = NULL, locked_by = NULL, updated_at = now(),
              error_message = COALESCE(error_message, 'Released stale running job')
        WHERE job_type = $1
          AND status = 'running'
          AND locked_at < now() - ($2::int * interval '1 second')
        RETURNING id`,
      [jobType, lockTimeoutSeconds],
    );
    return result.rows.length;
  }
}

export function buildClaimJobsSql() {
  return `UPDATE jobs
             SET status = 'running', attempts = attempts + 1, locked_at = now(), locked_by = $3, updated_at = now()
           WHERE id IN (
             SELECT id
               FROM jobs
              WHERE job_type = $1
                AND status = 'queued'
                AND run_after <= now()
              ORDER BY run_after ASC, created_at ASC
              LIMIT $2
              FOR UPDATE SKIP LOCKED
           )
           RETURNING id, job_type AS "jobType", payload, status, attempts, max_attempts AS "maxAttempts",
                     run_after AS "runAfter", locked_at AS "lockedAt", locked_by AS "lockedBy",
                     error_message AS "errorMessage", created_at AS "createdAt", updated_at AS "updatedAt"`;
}
