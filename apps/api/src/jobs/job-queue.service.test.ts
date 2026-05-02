import assert from 'node:assert/strict';
import test from 'node:test';
import { buildClaimJobsSql, buildListJobsSql } from './job-queue.service';

test('claims jobs with row locks that skip already locked work', () => {
  const sql = buildClaimJobsSql();

  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /LIMIT \$2/);
  assert.match(sql, /attempts = attempts \+ 1/);
});

test('lists jobs with submission and artifact filters capped to a safe limit', () => {
  const query = buildListJobsSql({
    jobType: 'parse_artifact',
    status: 'failed',
    submissionId: '00000000-0000-0000-0000-000000000001',
    artifactId: '00000000-0000-0000-0000-000000000002',
    limit: 999,
  });

  assert.match(query.sql, /payload->>'submissionId' = \$3/);
  assert.match(query.sql, /payload->>'artifactId' = \$4/);
  assert.match(query.sql, /ORDER BY created_at DESC/);
  assert.equal(query.params.at(-1), 200);
});
