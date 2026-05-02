import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArtifactStorageKey, sanitizeFileName } from './local-object-store.service';

test('sanitizes uploaded file names before storing them', () => {
  assert.equal(sanitizeFileName('../unsafe/report?.pdf'), 'report-.pdf');
  assert.equal(sanitizeFileName('\u0000'), 'artifact.bin');
});

test('builds stable storage keys under the artifact prefix', () => {
  const key = buildArtifactStorageKey({
    submissionId: '00000000-0000-0000-0000-000000000001',
    originalName: '报告.pdf',
    buffer: Buffer.from('demo'),
    sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    now: new Date('2026-05-02T00:00:00.000Z'),
  });

  assert.equal(key, 'artifacts/2026/05/00000000-0000-0000-0000-000000000001/1234567890abcdef-报告.pdf');
});
