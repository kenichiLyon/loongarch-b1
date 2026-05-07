import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ArtifactKind } from '../domain/core';
import { validateArtifactUpload } from './artifact-upload.policy';

test('accepts supported PDF uploads', () => {
  const result = validateArtifactUpload(
    ArtifactKind.Pdf,
    {
      originalname: 'report.pdf',
      mimetype: 'application/pdf',
      size: 4,
      buffer: Buffer.from('demo'),
    },
    1024,
  );

  assert.deepEqual(result, {
    originalName: 'report.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 4,
  });
});

test('rejects mismatched artifact kinds', () => {
  assert.throws(
    () =>
      validateArtifactUpload(
        ArtifactKind.Image,
        {
          originalname: 'report.pdf',
          mimetype: 'application/pdf',
          size: 4,
          buffer: Buffer.from('demo'),
        },
        1024,
      ),
    BadRequestException,
  );
});

test('rejects files above the configured limit', () => {
  assert.throws(
    () =>
      validateArtifactUpload(
        ArtifactKind.Pdf,
        {
          originalname: 'report.pdf',
          mimetype: 'application/pdf',
          size: 4,
          buffer: Buffer.from('demo'),
        },
        3,
      ),
    BadRequestException,
  );
});

test('rejects git link uploads on the file endpoint', () => {
  assert.throws(
    () =>
      validateArtifactUpload(
        ArtifactKind.GitLink,
        {
          originalname: 'repo.url',
          mimetype: 'text/plain',
          size: 10,
          buffer: Buffer.from('https://github.com/example/repo'),
        },
        1024,
      ),
    BadRequestException,
  );
});
