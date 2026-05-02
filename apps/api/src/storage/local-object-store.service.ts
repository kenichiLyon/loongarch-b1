import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface StoreArtifactInput {
  submissionId: string;
  originalName: string;
  buffer: Buffer;
  now?: Date;
}

export interface StoredObject {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
}

@Injectable()
export class LocalObjectStoreService {
  async storeArtifact(input: StoreArtifactInput): Promise<StoredObject> {
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    const storageKey = buildArtifactStorageKey({ ...input, sha256 });
    const root = getStorageRoot();
    const target = path.resolve(root, storageKey);

    if (!target.startsWith(`${root}${path.sep}`)) {
      throw new Error('Resolved storage path escaped STORAGE_ROOT');
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.buffer);

    return {
      storageKey: normalizeStorageKey(storageKey),
      sha256,
      sizeBytes: input.buffer.byteLength,
    };
  }
}

export function getStorageRoot() {
  return path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? './storage');
}

export function buildArtifactStorageKey(input: StoreArtifactInput & { sha256: string }) {
  const now = input.now ?? new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeName = sanitizeFileName(input.originalName);
  return normalizeStorageKey(path.join('artifacts', year, month, input.submissionId, `${input.sha256.slice(0, 16)}-${safeName}`));
}

export function sanitizeFileName(name: string) {
  const baseName = Array.from(path.basename(name))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();
  const safeName = baseName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
  return safeName || 'artifact.bin';
}

function normalizeStorageKey(value: string) {
  return value.split(path.sep).join('/');
}
