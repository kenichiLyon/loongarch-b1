import assert from 'node:assert/strict';
import test from 'node:test';
import { buildClaimJobsSql } from './job-queue.service';

test('claims jobs with row locks that skip already locked work', () => {
  const sql = buildClaimJobsSql();

  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /LIMIT \$2/);
  assert.match(sql, /attempts = attempts \+ 1/);
});
