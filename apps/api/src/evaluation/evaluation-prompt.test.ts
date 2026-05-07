import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvaluationPrompt } from './evaluation-prompt';

test('builds prompt from a persisted context snapshot payload', () => {
  const prompt = buildEvaluationPrompt({
    contextVersion: 'evaluation-context-v1',
    contextJson: {
      experiment: { title: 'Web 实训', requirementText: '实现登录页面 [REDACTED_EMAIL]' },
      rubric: { metrics: [{ id: 'metric-1', name: '功能' }] },
    },
    contextText: 'Submission\nExperiment',
    originalCharCount: 1200,
    redactedCharCount: 800,
    truncated: true,
    promptVersion: 'test-v1',
  });

  assert.equal(prompt.promptVersion, 'test-v1');
  assert.match(prompt.systemPrompt, /只输出 JSON/);
  assert.match(prompt.userPrompt, /evaluation-context-v1/);
  assert.match(prompt.userPrompt, /metric-1/);
  assert.match(prompt.userPrompt, /truncated/);
});
