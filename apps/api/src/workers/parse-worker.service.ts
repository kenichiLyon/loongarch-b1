import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { ArtifactKind } from '../domain/core';
import { JobQueueService, type JobRow } from '../jobs/job-queue.service';
import { extractArtifactContents, type ArtifactForParsing, type ExtractedContentDraft } from '../parser/artifact-parser';
import { LocalObjectStoreService } from '../storage/local-object-store.service';

interface ArtifactRow extends QueryResultRow, ArtifactForParsing {
  submissionId: string;
  status: string;
  errorMessage: string | null;
}

export interface ParseWorkerOptions {
  workerId: string;
  batchSize: number;
  retryDelaySeconds: number;
  staleAfterSeconds: number;
}

export interface ParseWorkerResult {
  claimed: number;
  succeeded: number;
  failed: number;
  releasedStale: number;
}

@Injectable()
export class ParseWorkerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jobQueue: JobQueueService,
    private readonly objectStore: LocalObjectStoreService,
    private readonly auditService: AuditService,
  ) {}

  async processBatch(options: ParseWorkerOptions): Promise<ParseWorkerResult> {
    const releasedStale = await this.jobQueue.releaseStaleRunningJobs('parse_artifact', options.staleAfterSeconds);
    const jobs = await this.jobQueue.claimJobs({ jobType: 'parse_artifact', workerId: options.workerId, limit: options.batchSize });
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        await this.processJob(job);
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

  private async processJob(job: JobRow) {
    const payload = parseJobPayload(job.payload);
    const artifact = await this.loadArtifact(payload.artifactId);
    const buffer = await this.objectStore.readObject(artifact.storageKey);
    const drafts = extractArtifactContents(artifact, buffer);

    await this.database.withTransaction(async (client) => {
      await client.query(
        `UPDATE artifacts
            SET status = 'parsing', error_message = NULL, updated_at = now()
          WHERE id = $1`,
        [artifact.id],
      );

      await client.query('DELETE FROM extracted_contents WHERE artifact_id = $1', [artifact.id]);
      await insertExtractedContents(client, artifact.id, drafts);

      await client.query(
        `UPDATE artifacts
            SET status = 'parsed', error_message = NULL, updated_at = now()
          WHERE id = $1`,
        [artifact.id],
      );

      await client.query(
        `UPDATE submissions s
            SET status = CASE
                  WHEN NOT EXISTS (
                    SELECT 1 FROM artifacts a
                     WHERE a.submission_id = s.id
                       AND a.status IN ('uploaded', 'parsing')
                  ) THEN 'submitted'
                  ELSE s.status
                END,
                updated_at = now()
          WHERE s.id = $1`,
        [artifact.submissionId],
      );

      await this.jobQueue.markSucceeded(client, job.id);

      await this.auditService.record({
        action: 'artifact.parse_succeeded',
        entityType: 'artifact',
        entityId: artifact.id,
        detail: {
          submissionId: artifact.submissionId,
          jobId: job.id,
          workerId: job.lockedBy,
          contentCount: drafts.length,
        },
        client,
      });
    });
  }

  private async failJob(job: JobRow, error: unknown, retryDelaySeconds: number) {
    const payload = safeParseJobPayload(job.payload);
    const message = getErrorMessage(error);

    await this.database.withTransaction(async (client) => {
      if (payload?.artifactId) {
        await client.query(
          `UPDATE artifacts
              SET status = CASE WHEN $2 THEN 'uploaded' ELSE 'failed' END,
                  error_message = $3,
                  updated_at = now()
            WHERE id = $1`,
          [payload.artifactId, job.attempts < job.maxAttempts, message],
        );
      }

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
        action: payload?.artifactId ? 'artifact.parse_failed' : 'job.parse_failed',
        entityType: payload?.artifactId ? 'artifact' : 'job',
        entityId: payload?.artifactId ?? job.id,
        detail: {
          submissionId: payload?.submissionId ?? null,
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

  private async loadArtifact(artifactId: string) {
    const result = await this.database.query<ArtifactRow>(
      `SELECT id, submission_id AS "submissionId", kind, original_name AS "originalName", mime_type AS "mimeType",
              size_bytes AS "sizeBytes", sha256, storage_key AS "storageKey", status, error_message AS "errorMessage"
         FROM artifacts
        WHERE id = $1`,
      [artifactId],
    );

    const artifact = result.rows[0];
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }
    if (!Object.values(ArtifactKind).includes(artifact.kind)) {
      throw new Error(`Unsupported artifact kind: ${artifact.kind}`);
    }
    return artifact;
  }
}

export function parseJobPayload(payload: Record<string, unknown>) {
  const parsed = safeParseJobPayload(payload);
  if (!parsed) {
    throw new Error('Invalid parse_artifact job payload');
  }
  return parsed;
}

function safeParseJobPayload(payload: Record<string, unknown>) {
  if (typeof payload.artifactId !== 'string' || typeof payload.submissionId !== 'string') {
    return null;
  }
  return {
    artifactId: payload.artifactId,
    submissionId: payload.submissionId,
  };
}

async function insertExtractedContents(client: PoolClient, artifactId: string, drafts: ExtractedContentDraft[]) {
  for (const draft of drafts) {
    await client.query(
      `INSERT INTO extracted_contents (artifact_id, source_ref, content_kind, content_text, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [artifactId, draft.sourceRef, draft.contentKind, draft.contentText, JSON.stringify(draft.metadata)],
    );
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }
  return String(error).slice(0, 2000);
}
