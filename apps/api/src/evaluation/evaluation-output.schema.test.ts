import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSkippedEvaluationDraft, validateEvaluationDraft } from './evaluation-output.schema';

const metrics = [
  { id: 'metric-1', name: '功能实现度', maxScore: 100 },
  { id: 'metric-2', name: '文档规范性', maxScore: 50 },
];

test('validates structured LLM evaluation output', () => {
  const draft = validateEvaluationDraft(
    {
      totalAiScore: 82.456,
      summary: '整体完成较好',
      metricScores: [
        { metricId: 'metric-1', aiScore: 80, confidence: 0.8, comments: ['ok'] },
        { metricId: 'metric-2', score: 40, confidence: 0.7 },
      ],
      findings: [
        {
          type: 'step',
          severity: 'warning',
          evidence: '缺少部署截图',
          suggestion: '补充部署步骤截图',
        },
      ],
    },
    metrics,
  );

  assert.equal(draft.totalAiScore, 82.46);
  assert.equal(draft.metricScores[1].aiScore, 40);
  assert.equal(draft.findings[0].type, 'step');
});

test('rejects unknown metric IDs and invalid finding severity', () => {
  assert.throws(
    () =>
      validateEvaluationDraft(
        {
          metricScores: [{ metricId: 'unknown', aiScore: 10 }],
          findings: [],
        },
        metrics,
      ),
    /metricId is unknown/,
  );

  assert.throws(
    () =>
      validateEvaluationDraft(
        {
          metricScores: [],
          findings: [{ type: 'logic', severity: 'bad', evidence: 'x', suggestion: 'y' }],
        },
        metrics,
      ),
    /severity is invalid/,
  );
});

test('builds skipped draft for unconfigured LLM gateway', () => {
  const draft = buildSkippedEvaluationDraft(metrics, 'LLM Gateway is not configured');

  assert.equal(draft.totalAiScore, null);
  assert.equal(draft.metricScores.length, 2);
  assert.equal(draft.metricScores[0].aiScore, null);
  assert.equal(draft.findings[0].severity, 'info');
});
