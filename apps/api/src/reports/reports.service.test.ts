import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { DatabaseService } from '../database/database.service';
import { UserRole } from '../domain/core';
import type { LocalObjectStoreService } from '../storage/local-object-store.service';
import { buildPublishedEvaluationWhere, ReportsService } from './reports.service';

const user: AuthenticatedUser = {
  id: '00000000-0000-0000-0000-000000000001',
  role: UserRole.Teacher,
  username: 'teacher',
  displayName: 'Teacher',
};

test('builds published evaluation filters with positional parameters', () => {
  const where = buildPublishedEvaluationWhere({
    courseId: 'course-id',
    classId: 'class-id',
    experimentId: 'experiment-id',
    studentId: 'student-id',
  });

  assert.match(where.sql, /er.status = 'published'/);
  assert.match(where.sql, /e.course_id = \$1/);
  assert.match(where.sql, /en.class_id = \$2/);
  assert.match(where.sql, /e.id = \$3/);
  assert.match(where.sql, /s.student_id = \$4/);
  assert.deepEqual(where.params, ['course-id', 'class-id', 'experiment-id', 'student-id']);
});

test('returns report statistics with numeric summaries', async () => {
  const service = buildService();

  const result = await service.getStatistics({ courseId: '00000000-0000-0000-0000-000000000010' });

  assert.equal(result.summary.publishedCount, 3);
  assert.equal(result.summary.averageScore, 82.67);
  assert.equal(result.metrics[0].averageFinalScore, 80);
  assert.equal(result.findings[0].count, 2);
});

test('queues report exports and audit events in one transaction', async () => {
  const capturedQueries: Array<{ sql: string; params: readonly unknown[] }> = [];
  const service = buildService(capturedQueries);

  const result = await service.createExport(
    {
      reportType: 'course',
      format: 'xlsx',
      filters: { courseId: '00000000-0000-0000-0000-000000000010' },
    },
    user,
  );

  assert.equal(result.status, 'queued');
  assert.equal(capturedQueries.some((query) => query.sql.includes('INSERT INTO jobs')), true);
  assert.equal(capturedQueries.some((query) => query.params.includes('report_export.queued')), true);
});

test('downloads succeeded report exports requested by the teacher', async () => {
  const capturedQueries: Array<{ sql: string; params: readonly unknown[] }> = [];
  const service = buildService(capturedQueries, Buffer.from('report-content'));

  const result = await service.downloadExport('00000000-0000-0000-0000-000000000020', user);

  assert.equal(result.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(result.fileName, /^course-report-.*\.xlsx$/);
  assert.equal(result.buffer.toString('utf8'), 'report-content');
  assert.equal(capturedQueries.some((query) => query.params.includes('report_export.downloaded')), true);
});

function buildService(capturedQueries: Array<{ sql: string; params: readonly unknown[] }> = [], objectBuffer = Buffer.from('')) {
  const client = {
    query: async (sql: string, params: readonly unknown[] = []) => handleQuery(sql, params, capturedQueries),
  } as unknown as PoolClient;
  const database = {
    query: async (sql: string, params: readonly unknown[] = []) => handleQuery(sql, params, capturedQueries),
    withTransaction: async <T>(handler: (poolClient: PoolClient) => Promise<T>) => handler(client),
  } as unknown as DatabaseService;
  const objectStore = {
    readObject: async () => objectBuffer,
  } as unknown as LocalObjectStoreService;
  return new ReportsService(database, new AuditService(database), objectStore);
}

async function handleQuery(sql: string, params: readonly unknown[], capturedQueries: Array<{ sql: string; params: readonly unknown[] }>) {
  capturedQueries.push({ sql, params });

  if (sql.includes('COUNT(*) AS "publishedCount"')) {
    return { rows: [{ publishedCount: '3', averageScore: '82.67', minScore: '70', maxScore: '90' }] };
  }

  if (sql.includes('AVG(ms.final_score)')) {
    return {
      rows: [
        {
          rubricMetricId: 'metric-1',
          metricName: '功能实现度',
          averageFinalScore: '80',
          averageTeacherScore: '85',
          averageAiScore: '77',
          averageRuleScore: '70',
        },
      ],
    };
  }

  if (sql.includes('vf.finding_type')) {
    return { rows: [{ findingType: 'requirement', severity: 'warning', count: '2' }] };
  }

  if (sql.includes('INSERT INTO report_exports')) {
    return {
      rows: [
        {
          id: '00000000-0000-0000-0000-000000000020',
          reportType: params[0],
          format: params[1],
          requestedBy: params[2],
          filterJson: JSON.parse(String(params[3])) as Record<string, string>,
          status: 'queued',
          storageKey: null,
          fileSha256: null,
          errorMessage: null,
          createdAt: '2026-05-03T00:00:00.000Z',
          completedAt: null,
        },
      ],
    };
  }

  if (sql.includes('FROM report_exports') && sql.includes('WHERE id = $1')) {
    return {
      rows: [
        {
          id: params[0],
          reportType: 'course',
          format: 'xlsx',
          requestedBy: user.id,
          filterJson: {},
          status: 'succeeded',
          storageKey: 'report-exports/2026/05/export.xlsx',
          fileSha256: 'sha256-value',
          errorMessage: null,
          createdAt: '2026-05-03T00:00:00.000Z',
          completedAt: '2026-05-03T00:00:01.000Z',
        },
      ],
    };
  }

  if (sql.includes('INSERT INTO audit_logs')) {
    return { rows: [{ id: 'audit-1' }] };
  }

  return { rows: [] };
}
