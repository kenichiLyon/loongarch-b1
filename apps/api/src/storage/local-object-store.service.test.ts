import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildArtifactStorageKey,
  buildReportExportStorageKey,
  LocalObjectStoreService,
  sanitizeFileName,
} from './local-object-store.service';

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

test('builds stable storage keys under the report export prefix', () => {
  const key = buildReportExportStorageKey({
    exportId: '00000000-0000-0000-0000-000000000010',
    reportType: 'course',
    format: 'xlsx',
    buffer: Buffer.from('demo'),
    sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    now: new Date('2026-05-03T00:00:00.000Z'),
  });

  assert.equal(
    key,
    'report-exports/2026/05/00000000-0000-0000-0000-000000000010/course-00000000-0000-0000-0000-000000000010-abcdef1234567890.xlsx',
  );
});

test('stores artifact files from disk without buffering uploads in memory', async () => {
  const previousStorageRoot = process.env.STORAGE_ROOT;
  const root = await mkdtemp(path.join(os.tmpdir(), 'loongarch-b1-store-'));
  const objectRoot = path.join(root, 'objects');
  const source = path.join(root, 'source.txt');
  process.env.STORAGE_ROOT = objectRoot;

  try {
    await writeFile(source, 'hello');
    const service = new LocalObjectStoreService();
    const result = await service.storeArtifact({
      submissionId: '00000000-0000-0000-0000-000000000001',
      originalName: 'source.txt',
      sourcePath: source,
      now: new Date('2026-05-02T00:00:00.000Z'),
    });

    assert.equal(result.sizeBytes, 5);
    assert.equal(await readFile(path.join(objectRoot, result.storageKey), 'utf8'), 'hello');
  } finally {
    if (previousStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT;
    } else {
      process.env.STORAGE_ROOT = previousStorageRoot;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test('stores report export buffers in object storage', async () => {
  const previousStorageRoot = process.env.STORAGE_ROOT;
  const root = await mkdtemp(path.join(os.tmpdir(), 'loongarch-b1-report-store-'));
  const objectRoot = path.join(root, 'objects');
  process.env.STORAGE_ROOT = objectRoot;

  try {
    const service = new LocalObjectStoreService();
    const result = await service.storeReportExport({
      exportId: '00000000-0000-0000-0000-000000000010',
      reportType: 'course',
      format: 'pdf',
      buffer: Buffer.from('%PDF-demo'),
      now: new Date('2026-05-03T00:00:00.000Z'),
    });

    assert.equal(result.sizeBytes, 9);
    assert.equal(await readFile(path.join(objectRoot, result.storageKey), 'utf8'), '%PDF-demo');
  } finally {
    if (previousStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT;
    } else {
      process.env.STORAGE_ROOT = previousStorageRoot;
    }
    await rm(root, { recursive: true, force: true });
  }
});
