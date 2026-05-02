import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface StoreArtifactInput {
  submissionId: string;
  originalName: string;
  buffer?: Buffer;
  sourcePath?: string;
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
    const sha256 = input.buffer ? createHash('sha256').update(input.buffer).digest('hex') : await hashFile(input.sourcePath);
    const sizeBytes = input.buffer?.byteLength ?? (await statFile(input.sourcePath)).size;
    const storageKey = buildArtifactStorageKey({ ...input, sha256 });
    const target = resolveStoragePath(storageKey);

    await mkdir(path.dirname(target), { recursive: true });
    if (input.buffer) {
      await writeFile(target, input.buffer);
    } else if (input.sourcePath) {
      await copyFile(input.sourcePath, target);
    } else {
      throw new Error('Either buffer or sourcePath is required to store an artifact');
    }

    return {
      storageKey: normalizeStorageKey(storageKey),
      sha256,
      sizeBytes,
    };
  }

  async readObject(storageKey: string) {
    return readFile(resolveStoragePath(storageKey));
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

function resolveStoragePath(storageKey: string) {
  const root = getStorageRoot();
  const target = path.resolve(root, storageKey);

  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('Resolved storage path escaped STORAGE_ROOT');
  }

  return target;
}

async function hashFile(sourcePath: string | undefined) {
  if (!sourcePath) {
    throw new Error('sourcePath is required when buffer is not provided');
  }

  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(sourcePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function statFile(sourcePath: string | undefined) {
  if (!sourcePath) {
    throw new Error('sourcePath is required when buffer is not provided');
  }
  return stat(sourcePath);
}
