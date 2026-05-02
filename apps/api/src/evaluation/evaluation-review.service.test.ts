import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { DatabaseService } from '../database/database.service';
import { UserRole } from '../domain/core';
import type { LlmGatewayService } from '../llm/llm-gateway.service';
import { EvaluationService } from './evaluation.service';

const submissionId = '00000000-0000-0000-0000-000000000001';
const reviewer: AuthenticatedUser = {
  id: '00000000-0000-0000-0000-000000000099',
  role: UserRole.Teacher,
  username: 'teacher',
  displayName: 'Teacher',
};

test('teacher review persists metric overrides and weighted final score', async () => {
  const state = buildReviewState();
  const service = buildService(state);

  await service.reviewSubmission(
    submissionId,
    {
      teacherComment: '总体达到要求',
      metricScores: [
        {
          rubricMetricId: state.metrics[0].rubricMetricId,
          teacherScore: 80,
          comment: '登录流程完整',
        },
      ],
    },
    reviewer,
  );

  assert.equal(state.evaluation.status, 'teacher_reviewed');
  assert.equal(state.evaluation.finalScore, '72');
  assert.equal(state.evaluation.teacherComment, '总体达到要求');
  assert.equal(state.metrics[0].teacherScore, '80');
  assert.equal(state.metrics[0].finalScore, '80');
  assert.equal(state.metrics[1].finalScore, '60');
  assert.equal(state.auditActions.includes('submission.teacher_reviewed'), true);
});

test('teacher review rejects scores above the metric maximum', async () => {
  const state = buildReviewState();
  const service = buildService(state);

  await assert.rejects(
    () =>
      service.reviewSubmission(
        submissionId,
        {
          metricScores: [
            {
              rubricMetricId: state.metrics[0].rubricMetricId,
              teacherScore: 101,
            },
          ],
        },
        reviewer,
      ),
    /between 0 and 100/,
  );
});

test('publishes teacher-reviewed evaluations and submission feedback', async () => {
  const state = buildReviewState({ status: 'teacher_reviewed', finalScore: '72' });
  const service = buildService(state);

  await service.publishEvaluation(submissionId, reviewer);

  assert.equal(state.evaluation.status, 'published');
  assert.equal(state.submission.status, 'published');
  assert.equal(state.auditActions.includes('submission.evaluation_published'), true);
});

test('student feedback endpoint only returns published own evaluation', async () => {
  const state = buildReviewState({ status: 'published', finalScore: '72' });
  const service = buildService(state);

  await assert.doesNotReject(() =>
    service.getPublishedEvaluation(submissionId, {
      id: state.submission.studentId,
      role: UserRole.Student,
      username: 'student',
      displayName: 'Student',
    }),
  );

  await assert.rejects(
    () =>
      service.getPublishedEvaluation(submissionId, {
        id: '00000000-0000-0000-0000-000000000088',
        role: UserRole.Student,
        username: 'other',
        displayName: 'Other',
      }),
    /Students can only view their own published feedback/,
  );
});

function buildReviewState(input: { status?: string; finalScore?: string | null } = {}) {
  return {
    submission: {
      id: submissionId,
      studentId: '00000000-0000-0000-0000-000000000002',
      status: 'teacher_review',
    },
    evaluation: {
      id: '00000000-0000-0000-0000-000000000010',
      submissionId,
      status: input.status ?? 'ai_draft',
      totalTeacherScore: null as string | null,
      finalScore: input.finalScore ?? null,
      teacherComment: null as string | null,
    },
    metrics: [
      {
        id: 'score-1',
        rubricMetricId: '00000000-0000-0000-0000-000000000011',
        metricName: '功能实现度',
        weight: '60',
        maxScore: '100',
        ruleScore: '50',
        aiScore: '70',
        teacherScore: null as string | null,
        finalScore: null as string | null,
        comments: ['AI：功能基本完成'],
      },
      {
        id: 'score-2',
        rubricMetricId: '00000000-0000-0000-0000-000000000012',
        metricName: '文档规范性',
        weight: '40',
        maxScore: '100',
        ruleScore: '55',
        aiScore: '60',
        teacherScore: null as string | null,
        finalScore: null as string | null,
        comments: [],
      },
    ],
    auditActions: [] as string[],
  };
}

function buildService(state: ReturnType<typeof buildReviewState>) {
  const client = {
    query: async (sql: string, params: readonly unknown[]) => handleQuery(sql, params, state),
  } as unknown as PoolClient;
  const database = {
    query: async (sql: string, params: readonly unknown[] = []) => handleQuery(sql, params, state),
    withTransaction: async <T>(handler: (poolClient: PoolClient) => Promise<T>) => handler(client),
  } as unknown as DatabaseService;
  const llmGateway = {} as unknown as LlmGatewayService;
  return new EvaluationService(database, llmGateway, new AuditService(database));
}

async function handleQuery(sql: string, params: readonly unknown[], state: ReturnType<typeof buildReviewState>) {
  if (sql.includes('FROM evaluation_results er')) {
    return {
      rows: [
        {
          id: state.evaluation.id,
          submissionId: state.evaluation.submissionId,
          studentId: state.submission.studentId,
          status: state.evaluation.status,
          finalScore: state.evaluation.finalScore,
        },
      ],
    };
  }

  if (sql.includes('FROM metric_scores ms') && sql.includes('FOR UPDATE OF ms')) {
    return { rows: state.metrics.map((metric) => ({ ...metric })) };
  }

  if (sql.includes('UPDATE metric_scores') && sql.includes('COALESCE(teacher_score, ai_score, rule_score)')) {
    for (const metric of state.metrics) {
      metric.finalScore = metric.teacherScore ?? metric.aiScore ?? metric.ruleScore;
    }
    return { rows: [] };
  }

  if (sql.includes('UPDATE metric_scores') && sql.includes('SET teacher_score')) {
    const metric = state.metrics.find((item) => item.rubricMetricId === params[1]);
    if (metric) {
      metric.teacherScore = String(params[2]);
      metric.finalScore = String(params[2]);
      metric.comments = JSON.parse(String(params[3])) as string[];
    }
    return { rows: [] };
  }

  if (sql.includes('UPDATE evaluation_results') && sql.includes("status = 'teacher_reviewed'")) {
    state.evaluation.status = 'teacher_reviewed';
    state.evaluation.totalTeacherScore = String(params[1]);
    state.evaluation.finalScore = String(params[1]);
    state.evaluation.teacherComment = (params[2] as string | null) ?? state.evaluation.teacherComment;
    return { rows: [] };
  }

  if (sql.includes('UPDATE evaluation_results') && sql.includes("status = 'published'")) {
    state.evaluation.status = 'published';
    return { rows: [] };
  }

  if (sql.includes('UPDATE submissions') && sql.includes("status = 'published'")) {
    state.submission.status = 'published';
    return { rows: [] };
  }

  if (sql.includes('INSERT INTO audit_logs')) {
    state.auditActions.push(params[1] as string);
    return { rows: [{ id: 'audit-1' }] };
  }

  if (sql.includes('FROM submissions') && sql.includes('WHERE id = $1')) {
    return {
      rows: [
        {
          submissionId: state.submission.id,
          studentId: state.submission.studentId,
          status: state.submission.status,
        },
      ],
    };
  }

  if (sql.includes('FROM evaluation_results') && sql.includes("status = 'published'")) {
    return { rows: state.evaluation.status === 'published' ? [{ id: state.evaluation.id }] : [] };
  }

  if (sql.includes('FROM evaluation_results') && sql.includes('WHERE submission_id = $1')) {
    return {
      rows: [
        {
          id: state.evaluation.id,
          submissionId: state.evaluation.submissionId,
          status: state.evaluation.status,
          totalAiScore: '65',
          totalTeacherScore: state.evaluation.totalTeacherScore,
          finalScore: state.evaluation.finalScore,
          teacherComment: state.evaluation.teacherComment,
          createdAt: '2026-05-03T00:00:00.000Z',
          updatedAt: '2026-05-03T00:00:00.000Z',
        },
      ],
    };
  }

  if (sql.includes('FROM metric_scores ms')) {
    return { rows: state.metrics.map((metric) => ({ ...metric })) };
  }

  if (sql.includes('FROM verification_findings')) {
    return { rows: [] };
  }

  return { rows: [] };
}
