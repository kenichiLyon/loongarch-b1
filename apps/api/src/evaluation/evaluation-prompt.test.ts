import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvaluationPrompt } from './evaluation-prompt';

test('builds prompt with redacted evidence and metric IDs', () => {
  const prompt = buildEvaluationPrompt({
    experimentTitle: 'Web 实训',
    requirementText: '实现登录页面',
    metrics: [
      {
        id: 'metric-1',
        name: '功能',
        description: '覆盖要求',
        weight: 60,
        maxScore: 100,
        scoringRule: '检查功能完成度',
      },
    ],
    evidence: [{ sourceRef: 'report.md#text', contentKind: 'text', contentText: '邮箱 a@example.com' }],
    promptVersion: 'test-v1',
  });

  assert.equal(prompt.promptVersion, 'test-v1');
  assert.match(prompt.systemPrompt, /只输出 JSON/);
  assert.match(prompt.userPrompt, /metric-1/);
  assert.doesNotMatch(prompt.userPrompt, /a@example.com/);
  assert.match(prompt.userPrompt, /\[REDACTED_EMAIL\]/);
});
