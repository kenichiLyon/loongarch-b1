import { BadRequestException } from '@nestjs/common';
import path from 'node:path';
import { ArtifactKind } from '../domain/core';

export interface UploadFileLike {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer?: Buffer;
}

export interface ValidatedArtifactFile {
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
}

const defaultUploadMaxBytes = 20 * 1024 * 1024;

const allowedTypes: Record<ArtifactKind, { extensions: string[]; mimeTypes?: string[]; mimePrefixes?: string[] }> = {
  [ArtifactKind.Word]: {
    extensions: ['.doc', '.docx'],
    mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  [ArtifactKind.Pdf]: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
  },
  [ArtifactKind.Image]: {
    extensions: ['.png', '.jpg', '.jpeg', '.webp'],
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    mimePrefixes: ['image/'],
  },
  [ArtifactKind.CodeArchive]: {
    extensions: ['.zip', '.tar', '.gz', '.tgz'],
    mimeTypes: ['application/zip', 'application/x-zip-compressed', 'application/gzip', 'application/x-gzip', 'application/x-tar', 'application/octet-stream'],
  },
  [ArtifactKind.GitLink]: {
    extensions: [],
  },
  [ArtifactKind.Other]: {
    extensions: ['.txt', '.md', '.json', '.csv'],
    mimeTypes: ['text/plain', 'text/markdown', 'application/json', 'text/csv', 'application/octet-stream'],
    mimePrefixes: ['text/'],
  },
};

export function validateArtifactUpload(kind: ArtifactKind, file: UploadFileLike | undefined, maxBytes = readUploadMaxBytes()): ValidatedArtifactFile {
  if (!file) {
    throw new BadRequestException('Multipart field "file" is required');
  }
  if (!file.buffer || file.buffer.byteLength === 0) {
    throw new BadRequestException('Uploaded file is empty');
  }
  if (kind === ArtifactKind.GitLink) {
    throw new BadRequestException('Git links must be submitted through the Git link endpoint');
  }
  if (file.size > maxBytes || file.buffer.byteLength > maxBytes) {
    throw new BadRequestException(`Uploaded file exceeds max size ${maxBytes} bytes`);
  }

  const originalName = file.originalname || 'artifact.bin';
  const extension = path.extname(originalName).toLowerCase();
  const rule = allowedTypes[kind];
  if (!rule.extensions.includes(extension)) {
    throw new BadRequestException(`File extension ${extension || '(none)'} is not allowed for artifact kind ${kind}`);
  }

  const mimeType = file.mimetype?.toLowerCase() || null;
  if (mimeType && !isAllowedMime(rule, mimeType)) {
    throw new BadRequestException(`MIME type ${mimeType} is not allowed for artifact kind ${kind}`);
  }

  return {
    originalName,
    mimeType,
    sizeBytes: file.buffer.byteLength,
  };
}

export function readUploadMaxBytes() {
  const configured = Number(process.env.UPLOAD_MAX_BYTES ?? defaultUploadMaxBytes);
  if (!Number.isFinite(configured) || configured <= 0) {
    throw new Error('UPLOAD_MAX_BYTES must be a positive number');
  }
  return Math.floor(configured);
}

function isAllowedMime(rule: { mimeTypes?: string[]; mimePrefixes?: string[] }, mimeType: string) {
  return Boolean(rule.mimeTypes?.includes(mimeType) || rule.mimePrefixes?.some((prefix) => mimeType.startsWith(prefix)));
}
