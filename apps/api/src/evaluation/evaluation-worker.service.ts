import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { JobQueueService, type JobRow } from '../jobs/job-queue.service';
import { EvaluationService } from './evaluation.service';

export interface EvaluationWorkerOptions {
  workerId: string;
  batchSize: number;
  retryDelaySeconds: number;
  staleAfterSeconds: number;
}

export interface EvaluationWorkerResult {
  claimed: number;
  succeeded: number;
  failed: number;
  releasedStale: number;
}

@Injectable()
export class EvaluationWorkerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jobQueue: JobQueueService,
    private readonly evaluationService: EvaluationService,
    private readonly auditService: AuditService,
  ) {}

  async processBatch(options: EvaluationWorkerOptions): Promise<EvaluationWorkerResult> {
    const releasedStale = await this.jobQueue.releaseStaleRunningJobs('evaluate_submission', options.staleAfterSeconds);
    const jobs = await this.jobQueue.claimJobs({ jobType: 'evaluate_submission', workerId: options.workerId, limit: options.batchSize });
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const payload = parseEvaluationJobPayload(job.payload);
        await this.evaluationService.evaluateSubmission(payload.submissionId);
        await this.database.withTransaction(async (client) => {
          await this.jobQueue.markSucceeded(client, job.id);
        });
        succeeded += 1;
      } catch (error) {
        await this.failJob(job, error, options.retryDelaySeconds);
        failed += 1;
      }
    }

    return {
      claimed: jobs.length,
      succeeded,
      failed,
      releasedStale,
    };
  }

  private async failJob(job: JobRow, error: unknown, retryDelaySeconds: number) {
    const payload = safeParseEvaluationJobPayload(job.payload);
    const message = getErrorMessage(error);

    await this.database.withTransaction(async (client) => {
      if (payload?.submissionId && job.attempts >= job.maxAttempts) {
        await client.query(
          `UPDATE submissions
              SET status = 'failed', current_error = $2, updated_at = now()
            WHERE id = $1`,
          [payload.submissionId, message],
        );
      }

      await this.jobQueue.markFailed(client, job, message, retryDelaySeconds);

      await this.auditService.record({
        action: 'submission.evaluation_failed',
        entityType: payload?.submissionId ? 'submission' : 'job',
        entityId: payload?.submissionId ?? job.id,
        detail: {
          jobId: job.id,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          retryScheduled: job.attempts < job.maxAttempts,
          errorMessage: message,
        },
        client,
      });
    });
  }
}

export function parseEvaluationJobPayload(payload: Record<string, unknown>) {
  const parsed = safeParseEvaluationJobPayload(payload);
  if (!parsed) {
    throw new Error('Invalid evaluate_submission job payload');
  }
  return parsed;
}

function safeParseEvaluationJobPayload(payload: Record<string, unknown>) {
  if (typeof payload.submissionId !== 'string') {
    return null;
  }
  return {
    submissionId: payload.submissionId,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }
  return String(error).slice(0, 2000);
}
