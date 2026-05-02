import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEvaluationJobPayload } from './evaluation-worker.service';

test('validates evaluation worker job payloads', () => {
  assert.deepEqual(parseEvaluationJobPayload({ submissionId: 'submission-id' }), {
    submissionId: 'submission-id',
  });

  assert.throws(() => parseEvaluationJobPayload({ artifactId: 'artifact-id' }), /Invalid evaluate_submission job payload/);
});
