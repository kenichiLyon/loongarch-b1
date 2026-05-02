import assert from 'node:assert/strict';
import test from 'node:test';
import { addEqualityFilter, clampQueryLimit } from './sql-query.helpers';

test('adds equality filters with positional parameters', () => {
  const where: string[] = [];
  const params: unknown[] = [];

  addEqualityFilter(where, params, 'status', 'queued');
  addEqualityFilter(where, params, 'job_type', undefined);
  addEqualityFilter(where, params, 'actor_id', '00000000-0000-0000-0000-000000000001');

  assert.deepEqual(where, ['status = $1', 'actor_id = $2']);
  assert.deepEqual(params, ['queued', '00000000-0000-0000-0000-000000000001']);
});

test('clamps query limits to safe defaults and maximums', () => {
  assert.equal(clampQueryLimit(undefined), 50);
  assert.equal(clampQueryLimit(0), 50);
  assert.equal(clampQueryLimit(7.8), 7);
  assert.equal(clampQueryLimit(999), 200);
});
