import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvaluationContextSnapshot } from './evaluation-context-builder.service';

test('builds deterministic redacted evaluation context snapshots', () => {
  const snapshot = buildEvaluationContextSnapshot({
    submission: {
      submissionId: 'submission-1',
      studentId: '202312345678',
      status: 'evaluating',
    },
    experiment: {
      title: 'Web 实训',
      requirementText: '实现登录页面并上传截图，联系邮箱 admin@example.com',
    },
    rubric: {
      templateId: 'rubric-1',
      name: '默认模板',
      metrics: [
        {
          id: 'metric-1',
          name: '功能实现度',
          description: '功能覆盖情况',
          weight: '60',
          maxScore: '100',
          scoringRule: '检查登录、退出、错误提示',
          sortOrder: 0,
        },
      ],
    },
    artifacts: [
      {
        id: 'artifact-1',
        kind: 'pdf',
        originalName: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: '1200',
        sha256: 'abcdef0123456789',
        storageKey: 'artifacts/demo/report.pdf',
        status: 'parsed',
      },
    ],
    evidence: [
      {
        sourceRef: 'report.pdf#text',
        contentKind: 'text',
        contentText: '联系人 13812345678 邮箱 admin@example.com',
      },
    ],
    ruleCheck: {
      metricScores: [{ metricId: 'metric-1', ruleScore: 80, comments: ['功能覆盖较完整'] }],
      findings: [
        {
          type: 'step',
          severity: 'warning',
          evidence: '缺少异常路径截图',
          suggestion: '补充错误提示截图',
          sourceRef: 'report.pdf#text',
        },
      ],
    },
    promptVersion: 'evaluation-v1',
    contextVersion: 'evaluation-context-v1',
    maxChars: 1200,
  });

  assert.equal(snapshot.promptVersion, 'evaluation-v1');
  assert.equal(snapshot.contextVersion, 'evaluation-context-v1');
  assert.match(snapshot.contextText, /Submission/);
  assert.match(snapshot.contextText, /\[REDACTED_EMAIL\]/);
  assert.match(snapshot.contextText, /\[REDACTED_PHONE\]/);
  assert.doesNotMatch(snapshot.contextText, /admin@example.com/);
  assert.equal(snapshot.sourceCounts.evidenceCount, 1);
});

test('marks context as truncated when budgets are exceeded', () => {
  const snapshot = buildEvaluationContextSnapshot({
    submission: {
      submissionId: 'submission-2',
      studentId: 'student-2',
      status: 'evaluating',
    },
    experiment: {
      title: 'Long Experiment',
      requirementText: 'A'.repeat(300),
    },
    rubric: {
      templateId: 'rubric-2',
      name: '模板',
      metrics: [
        {
          id: 'metric-1',
          name: '功能',
          description: 'B'.repeat(300),
          weight: '100',
          maxScore: '100',
          scoringRule: 'C'.repeat(300),
          sortOrder: 0,
        },
      ],
    },
    artifacts: [],
    evidence: [{ sourceRef: 'x', contentKind: 'text', contentText: 'D'.repeat(600) }],
    ruleCheck: {
      metricScores: [{ metricId: 'metric-1', ruleScore: 50, comments: ['E'.repeat(200)] }],
      findings: [],
    },
    promptVersion: 'evaluation-v1',
    maxChars: 200,
  });

  assert.equal(snapshot.truncated, true);
  assert.ok(snapshot.redactedCharCount <= 2000);
});
