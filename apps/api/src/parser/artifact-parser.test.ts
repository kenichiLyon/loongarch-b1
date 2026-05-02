import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactKind } from '../domain/core';
import { extractArtifactContents } from './artifact-parser';

test('extracts text content from supported text-like artifacts', () => {
  const drafts = extractArtifactContents(
    {
      id: 'artifact-1',
      kind: ArtifactKind.Other,
      originalName: 'report.md',
      mimeType: 'text/markdown',
      sizeBytes: 11,
      sha256: 'hash',
      storageKey: 'artifacts/demo/report.md',
    },
    Buffer.from('hello world'),
    100,
  );

  assert.equal(drafts.length, 2);
  assert.equal(drafts[1].contentKind, 'text');
  assert.equal(drafts[1].contentText, 'hello world');
});

test('truncates large text extraction for worker stability', () => {
  const drafts = extractArtifactContents(
    {
      id: 'artifact-1',
      kind: ArtifactKind.Other,
      originalName: 'report.txt',
      mimeType: 'text/plain',
      sizeBytes: 10,
      sha256: 'hash',
      storageKey: 'artifacts/demo/report.txt',
    },
    Buffer.from('0123456789'),
    4,
  );

  assert.equal(drafts[1].contentText, '0123');
  assert.equal(drafts[1].metadata.truncated, true);
});

test('uses placeholders for advanced binary parsers', () => {
  const drafts = extractArtifactContents(
    {
      id: 'artifact-1',
      kind: ArtifactKind.Pdf,
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      sha256: 'hash',
      storageKey: 'artifacts/demo/report.pdf',
    },
    Buffer.from('%PDF-demo'),
    100,
  );

  assert.equal(drafts.length, 2);
  assert.equal(drafts[1].metadata.pendingAdvancedParser, true);
});
