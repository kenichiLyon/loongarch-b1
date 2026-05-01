import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRubricMetrics, type RubricMetric } from './core';

const baseMetrics: RubricMetric[] = [
  {
    id: 'functionality',
    name: '功能实现度',
    description: '检查实训要求覆盖情况',
    weight: 40,
    maxScore: 100,
    allowTeacherOverride: true,
  },
  {
    id: 'documentation',
    name: '文档规范性',
    description: '检查报告结构与表达规范',
    weight: 30,
    maxScore: 100,
    allowTeacherOverride: true,
  },
  {
    id: 'code-quality',
    name: '代码质量',
    description: '检查代码结构和可维护性',
    weight: 30,
    maxScore: 100,
    allowTeacherOverride: true,
  },
];

test('validates rubric metrics whose weights sum to 100', () => {
  const result = validateRubricMetrics(baseMetrics);

  assert.equal(result.valid, true);
  assert.equal(result.totalWeight, 100);
  assert.deepEqual(result.errors, []);
});

test('rejects empty and unbalanced metric definitions', () => {
  const result = validateRubricMetrics([
    {
      ...baseMetrics[0],
      weight: 25,
      maxScore: 0,
    },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /最高分必须大于 0/);
  assert.match(result.errors.join('\n'), /权重总和必须为 100/);
});
