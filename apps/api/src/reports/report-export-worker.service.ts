import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { JobQueueService, type JobRow } from '../jobs/job-queue.service';
import { LocalObjectStoreService } from '../storage/local-object-store.service';
import { renderReportDocument } from './report-renderer';
import type { ReportFormat, ReportType } from './reports.dto';
import { ReportsService } from './reports.service';

export interface ReportExportWorkerOptions {
  workerId: string;
  batchSize: number;
  retryDelaySeconds: number;
  staleAfterSeconds: number;
}

export interface ReportExportWorkerResult {
  claimed: number;
  succeeded: number;
  failed: number;
  releasedStale: number;
}

@Injectable()
export class ReportExportWorkerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jobQueue: JobQueueService,
    private readonly reportsService: ReportsService,
    private readonly objectStore: LocalObjectStoreService,
    private readonly auditService: AuditService,
  ) {}

  async processBatch(options: ReportExportWorkerOptions): Promise<ReportExportWorkerResult> {
    const releasedStale = await this.jobQueue.releaseStaleRunningJobs('export_report', options.staleAfterSeconds);
    const jobs = await this.jobQueue.claimJobs({ jobType: 'export_report', workerId: options.workerId, limit: options.batchSize });
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
    const payload = parseReportExportJobPayload(job.payload);
    const reportExport = await this.database.withTransaction(async (client) => {
      const row = await this.reportsService.loadExportForWorker(client, payload.exportId);
      await client.query(
        `UPDATE report_exports
            SET status = 'running', error_message = NULL
          WHERE id = $1`,
        [row.id],
      );
      return row;
    });

    const statistics = await this.reportsService.getStatistics(reportExport.filterJson);
    const document = renderReportDocument({
      reportType: reportExport.reportType as ReportType,
      format: reportExport.format as ReportFormat,
      statistics,
    });
    const stored = await this.objectStore.storeReportExport({
      exportId: reportExport.id,
      reportType: reportExport.reportType,
      format: document.fileExtension,
      buffer: document.buffer,
    });

    await this.database.withTransaction(async (client) => {
      await client.query(
        `UPDATE report_exports
            SET status = 'succeeded',
                storage_key = $2,
                file_sha256 = $3,
                error_message = NULL,
                completed_at = now()
          WHERE id = $1`,
        [reportExport.id, stored.storageKey, stored.sha256],
      );
      await this.jobQueue.markSucceeded(client, job.id);
      await this.auditService.record({
        actorId: reportExport.requestedBy,
        action: 'report_export.succeeded',
        entityType: 'report_export',
        entityId: reportExport.id,
        detail: {
          jobId: job.id,
          workerId: job.lockedBy,
          reportType: reportExport.reportType,
          format: reportExport.format,
          storageKey: stored.storageKey,
          sizeBytes: stored.sizeBytes,
          mimeType: document.mimeType,
        },
        client,
      });
    });
  }

  private async failJob(job: JobRow, error: unknown, retryDelaySeconds: number) {
    const payload = safeParseReportExportJobPayload(job.payload);
    const message = getErrorMessage(error);

    await this.database.withTransaction(async (client) => {
      if (payload?.exportId) {
        await client.query(
          `UPDATE report_exports
              SET status = $2,
                  error_message = $3,
                  completed_at = CASE WHEN $2 = 'failed' THEN now() ELSE completed_at END
            WHERE id = $1`,
          [payload.exportId, job.attempts < job.maxAttempts ? 'queued' : 'failed', message],
        );
      }

      await this.jobQueue.markFailed(client, job, message, retryDelaySeconds);
      await this.auditService.record({
        action: 'report_export.failed',
        entityType: payload?.exportId ? 'report_export' : 'job',
        entityId: payload?.exportId ?? job.id,
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

export function parseReportExportJobPayload(payload: Record<string, unknown>) {
  const parsed = safeParseReportExportJobPayload(payload);
  if (!parsed) {
    throw new Error('Invalid export_report job payload');
  }
  return parsed;
}

function safeParseReportExportJobPayload(payload: Record<string, unknown>) {
  if (typeof payload.exportId !== 'string') {
    return null;
  }
  return {
    exportId: payload.exportId,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }
  return String(error).slice(0, 2000);
}
