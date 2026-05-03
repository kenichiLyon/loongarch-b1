import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { clampQueryLimit } from '../database/sql-query.helpers';
import type { CreateReportExportDto, ListReportExportsQueryDto, ReportExportStatus, ReportFilterDto } from './reports.dto';
import type { ReportFindingStatistic, ReportMetricStatistic, ReportStatisticSummary, ReportStatistics } from './report-renderer';

export interface ReportExportRow extends QueryResultRow {
  id: string;
  reportType: string;
  format: string;
  requestedBy: string | null;
  filterJson: Record<string, string>;
  status: ReportExportStatus;
  storageKey: string | null;
  fileSha256: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface SummaryRow extends QueryResultRow {
  publishedCount: string;
  averageScore: string | null;
  minScore: string | null;
  maxScore: string | null;
}

interface MetricStatisticRow extends QueryResultRow {
  rubricMetricId: string;
  metricName: string;
  averageFinalScore: string | null;
  averageTeacherScore: string | null;
  averageAiScore: string | null;
  averageRuleScore: string | null;
}

interface FindingStatisticRow extends QueryResultRow {
  findingType: string;
  severity: string;
  count: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async getStatistics(filters: ReportFilterDto = {}): Promise<ReportStatistics> {
    const normalizedFilters = normalizeFilters(filters);
    const where = buildPublishedEvaluationWhere(normalizedFilters);

    const summary = await this.database.query<SummaryRow>(
      `SELECT COUNT(*) AS "publishedCount",
              ROUND(AVG(er.final_score)::numeric, 2) AS "averageScore",
              ROUND(MIN(er.final_score)::numeric, 2) AS "minScore",
              ROUND(MAX(er.final_score)::numeric, 2) AS "maxScore"
         FROM evaluation_results er
         JOIN submissions s ON s.id = er.submission_id
         JOIN experiments e ON e.id = s.experiment_id
         LEFT JOIN enrollments en ON en.student_id = s.student_id AND en.course_id = e.course_id
        ${where.sql}`,
      where.params,
    );

    const metrics = await this.database.query<MetricStatisticRow>(
      `SELECT rm.id AS "rubricMetricId", rm.name AS "metricName",
              ROUND(AVG(ms.final_score)::numeric, 2) AS "averageFinalScore",
              ROUND(AVG(ms.teacher_score)::numeric, 2) AS "averageTeacherScore",
              ROUND(AVG(ms.ai_score)::numeric, 2) AS "averageAiScore",
              ROUND(AVG(ms.rule_score)::numeric, 2) AS "averageRuleScore"
         FROM evaluation_results er
         JOIN metric_scores ms ON ms.evaluation_result_id = er.id
         JOIN rubric_metrics rm ON rm.id = ms.rubric_metric_id
         JOIN submissions s ON s.id = er.submission_id
         JOIN experiments e ON e.id = s.experiment_id
         LEFT JOIN enrollments en ON en.student_id = s.student_id AND en.course_id = e.course_id
        ${where.sql}
        GROUP BY rm.id, rm.name, rm.sort_order
        ORDER BY rm.sort_order ASC, rm.name ASC`,
      where.params,
    );

    const findings = await this.database.query<FindingStatisticRow>(
      `SELECT vf.finding_type AS "findingType", vf.severity, COUNT(*) AS count
         FROM evaluation_results er
         JOIN verification_findings vf ON vf.evaluation_result_id = er.id
         JOIN submissions s ON s.id = er.submission_id
         JOIN experiments e ON e.id = s.experiment_id
         LEFT JOIN enrollments en ON en.student_id = s.student_id AND en.course_id = e.course_id
        ${where.sql}
        GROUP BY vf.finding_type, vf.severity
        ORDER BY count DESC, vf.finding_type ASC, vf.severity ASC`,
      where.params,
    );

    return {
      generatedAt: new Date().toISOString(),
      filters: normalizedFilters,
      summary: mapSummary(summary.rows[0]),
      metrics: metrics.rows.map(mapMetricStatistic),
      findings: findings.rows.map(mapFindingStatistic),
    };
  }

  async createExport(dto: CreateReportExportDto, user: AuthenticatedUser) {
    const filters = normalizeFilters(dto.filters ?? {});
    return this.database.withTransaction(async (client) => {
      const reportExport = await client.query<ReportExportRow>(
        `INSERT INTO report_exports (report_type, format, requested_by, filter_json, status)
         VALUES ($1, $2, $3, $4::jsonb, 'queued')
         RETURNING ${selectReportExportColumns()}`,
        [dto.reportType, dto.format, user.id, JSON.stringify(filters)],
      );
      const row = reportExport.rows[0];

      await client.query(
        `INSERT INTO jobs (job_type, payload)
         VALUES ('export_report', $1::jsonb)`,
        [JSON.stringify({ exportId: row.id })],
      );

      await this.auditService.record({
        actorId: user.id,
        action: 'report_export.queued',
        entityType: 'report_export',
        entityId: row.id,
        detail: {
          reportType: row.reportType,
          format: row.format,
          filters,
          queuedJobType: 'export_report',
        },
        client,
      });

      return row;
    });
  }

  async listExports(filters: ListReportExportsQueryDto) {
    const params: unknown[] = [];
    const where: string[] = [];

    if (filters.reportType) {
      params.push(filters.reportType);
      where.push(`report_type = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    params.push(clampQueryLimit(filters.limit));
    const result = await this.database.query<ReportExportRow>(
      `SELECT ${selectReportExportColumns()}
         FROM report_exports
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return result.rows;
  }

  async getExport(exportId: string) {
    const result = await this.database.query<ReportExportRow>(
      `SELECT ${selectReportExportColumns()}
         FROM report_exports
        WHERE id = $1`,
      [exportId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Report export not found');
    }
    return row;
  }

  async loadExportForWorker(client: PoolClient, exportId: string) {
    const result = await client.query<ReportExportRow>(
      `SELECT ${selectReportExportColumns()}
         FROM report_exports
        WHERE id = $1
        FOR UPDATE`,
      [exportId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Report export not found');
    }
    if (row.status === 'succeeded') {
      throw new BadRequestException('Report export has already succeeded');
    }
    return row;
  }
}

export function normalizeFilters(filters: ReportFilterDto): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const key of ['courseId', 'classId', 'experimentId', 'studentId'] as const) {
    if (filters[key]) {
      normalized[key] = filters[key];
    }
  }
  return normalized;
}

export function buildPublishedEvaluationWhere(filters: Record<string, string>) {
  const params: unknown[] = [];
  const where = [`er.status = 'published'`, 'er.final_score IS NOT NULL'];

  addFilter(where, params, 'e.course_id', filters.courseId);
  addFilter(where, params, 'en.class_id', filters.classId);
  addFilter(where, params, 'e.id', filters.experimentId);
  addFilter(where, params, 's.student_id', filters.studentId);

  return {
    sql: `WHERE ${where.join(' AND ')}`,
    params,
  };
}

function addFilter(where: string[], params: unknown[], column: string, value: string | undefined) {
  if (!value) {
    return;
  }
  params.push(value);
  where.push(`${column} = $${params.length}`);
}

function mapSummary(row: SummaryRow | undefined): ReportStatisticSummary {
  return {
    publishedCount: Number(row?.publishedCount ?? 0),
    averageScore: nullableNumber(row?.averageScore),
    minScore: nullableNumber(row?.minScore),
    maxScore: nullableNumber(row?.maxScore),
  };
}

function mapMetricStatistic(row: MetricStatisticRow): ReportMetricStatistic {
  return {
    rubricMetricId: row.rubricMetricId,
    metricName: row.metricName,
    averageFinalScore: nullableNumber(row.averageFinalScore),
    averageTeacherScore: nullableNumber(row.averageTeacherScore),
    averageAiScore: nullableNumber(row.averageAiScore),
    averageRuleScore: nullableNumber(row.averageRuleScore),
  };
}

function mapFindingStatistic(row: FindingStatisticRow): ReportFindingStatistic {
  return {
    findingType: row.findingType,
    severity: row.severity,
    count: Number(row.count),
  };
}

function nullableNumber(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function selectReportExportColumns() {
  return `id, report_type AS "reportType", format, requested_by AS "requestedBy",
          filter_json AS "filterJson", status, storage_key AS "storageKey",
          file_sha256 AS "fileSha256", error_message AS "errorMessage",
          created_at AS "createdAt", completed_at AS "completedAt"`;
}
