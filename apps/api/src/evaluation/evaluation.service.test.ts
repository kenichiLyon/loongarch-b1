import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { AuditService } from '../audit/audit.service';
import type { DatabaseService } from '../database/database.service';
import type { LlmGatewayService } from '../llm/llm-gateway.service';
import { EvaluationContextBuilderService } from './evaluation-context-builder.service';
import { EvaluationService } from './evaluation.service';

test('routes evaluation to teacher review when LLM gateway is not configured', async () => {
  const transactionQueries: Array<{ sql: string; params: readonly unknown[] }> = [];
  const client = fakeClient(async (sql, params) => {
    transactionQueries.push({ sql, params });
    if (sql.includes('INSERT INTO evaluation_results')) {
      return { rows: [{ id: 'evaluation-1' }] };
    }
    if (sql.includes('INSERT INTO evaluation_context_snapshots')) {
      return {
        rows: [
          {
            id: 'context-1',
            submissionId: '00000000-0000-0000-0000-000000000001',
            status: 'built',
            promptVersion: 'evaluation-v1',
            contextVersion: 'evaluation-context-v1',
            inputHash: 'hash',
            contextJson: {},
            contextText: 'context',
            originalCharCount: 10,
            redactedCharCount: 10,
            truncated: false,
            sourceCounts: {},
            createdAt: '2026-05-07T00:00:00.000Z',
          },
        ],
      };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
      return { rows: [{ id: 'audit-1' }] };
    }
    return { rows: [] };
  });
  const database = {
    query: async (sql: string) => {
      if (sql.includes('FROM submissions s')) {
        return {
          rows: [
            {
              submissionId: '00000000-0000-0000-0000-000000000001',
              studentId: '00000000-0000-0000-0000-000000000002',
              status: 'evaluating',
              experimentTitle: 'Web 实训',
              requirementText: '实现登录页面',
              rubricTemplateId: '00000000-0000-0000-0000-000000000003',
              rubricName: '默认模板',
            },
          ],
        };
      }
      if (sql.includes('FROM rubric_metrics')) {
        return {
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000004',
              name: '功能实现度',
              description: '登录页面覆盖',
              weight: '100',
              maxScore: '100',
              scoringRule: '检查登录页面',
              sortOrder: 0,
            },
          ],
        };
      }
      if (sql.includes('COUNT(*) AS "pendingCount"')) {
        return { rows: [{ pendingCount: '0' }] };
      }
      if (sql.includes('FROM extracted_contents')) {
        return {
          rows: [{ sourceRef: 'report.md#text', contentKind: 'text', contentText: '学生邮箱 a@example.com 已脱敏前文本' }],
        };
      }
      if (sql.includes('FROM artifacts') && sql.includes('ORDER BY created_at ASC')) {
        return {
          rows: [
            {
              id: 'artifact-1',
              kind: 'pdf',
              originalName: 'report.pdf',
              mimeType: 'application/pdf',
              sizeBytes: '1200',
              sha256: 'hash',
              storageKey: 'artifacts/demo/report.pdf',
              status: 'parsed',
            },
          ],
        };
      }
      return { rows: [] };
    },
    withTransaction: async <T>(handler: (poolClient: PoolClient) => Promise<T>) => handler(client),
  } as unknown as DatabaseService;
  const llmGateway = {
    isConfigured: () => false,
  } as unknown as LlmGatewayService;
  const service = new EvaluationService(database, llmGateway, new AuditService(database), new EvaluationContextBuilderService());

  const result = await service.evaluateSubmission('00000000-0000-0000-0000-000000000001');

  assert.equal(result.status, 'skipped');
  assert.equal(transactionQueries.some((query) => query.sql.includes('INSERT INTO evaluation_results')), true);
  assert.equal(transactionQueries.some((query) => query.sql.includes('INSERT INTO evaluation_context_snapshots')), true);
  assert.equal(transactionQueries.some((query) => query.sql.includes('INSERT INTO metric_scores')), true);
  assert.equal(transactionQueries.find((query) => query.sql.includes('INSERT INTO metric_scores'))?.params[2], 0);
  assert.equal(transactionQueries.some((query) => query.sql.includes('INSERT INTO audit_logs')), true);
  assert.equal(
    transactionQueries.some((query) => query.params.includes('submission.evaluation_skipped')),
    true,
  );
});

function fakeClient(query: (sql: string, params: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) {
  return {
    query,
  } as unknown as PoolClient;
}
