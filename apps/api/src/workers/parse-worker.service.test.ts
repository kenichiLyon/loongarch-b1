import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEnqueueEvaluationJobSql, parseJobPayload } from './parse-worker.service';

test('validates parse worker job payloads', () => {
  assert.deepEqual(parseJobPayload({ artifactId: 'artifact-id', submissionId: 'submission-id' }), {
    artifactId: 'artifact-id',
    submissionId: 'submission-id',
  });

  assert.throws(() => parseJobPayload({ artifactId: 'artifact-id' }), /Invalid parse_artifact job payload/);
});

test('enqueues evaluation jobs with database-level conflict protection', () => {
  const sql = buildEnqueueEvaluationJobSql();

  assert.match(sql, /ON CONFLICT/);
  assert.match(sql, /payload->>'submissionId'/);
  assert.match(sql, /DO NOTHING/);
});
