import path from 'node:path';
import { ArtifactKind } from '../domain/core';

export interface ArtifactForParsing {
  id: string;
  kind: ArtifactKind;
  originalName: string;
  mimeType: string | null;
  sizeBytes: string | number;
  sha256: string | null;
  storageKey: string;
}

export interface ExtractedContentDraft {
  sourceRef: string;
  contentKind: 'text' | 'ocr' | 'code_structure' | 'metadata';
  contentText: string;
  metadata: Record<string, unknown>;
}

const defaultMaxTextChars = 60_000;
const textExtensions = new Set(['.txt', '.md', '.json', '.csv']);
const textMimePrefixes = ['text/'];
const textMimeTypes = new Set(['application/json']);

export function extractArtifactContents(artifact: ArtifactForParsing, buffer: Buffer, maxTextChars = readParserMaxTextChars()): ExtractedContentDraft[] {
  const baseMetadata = {
    artifactId: artifact.id,
    kind: artifact.kind,
    originalName: artifact.originalName,
    mimeType: artifact.mimeType,
    sizeBytes: Number(artifact.sizeBytes),
    sha256: artifact.sha256,
    storageKey: artifact.storageKey,
  };

  const drafts: ExtractedContentDraft[] = [
    {
      sourceRef: artifact.storageKey,
      contentKind: 'metadata',
      contentText: `Uploaded artifact ${artifact.originalName} (${artifact.kind}, ${buffer.byteLength} bytes).`,
      metadata: baseMetadata,
    },
  ];

  if (isTextLikeArtifact(artifact)) {
    drafts.push({
      sourceRef: `${artifact.storageKey}#text`,
      contentKind: 'text',
      contentText: decodeText(buffer, maxTextChars),
      metadata: {
        ...baseMetadata,
        parser: 'utf8-text-v1',
        truncated: buffer.toString('utf8').length > maxTextChars,
        maxTextChars,
      },
    });
    return drafts;
  }

  if (artifact.kind === ArtifactKind.Image) {
    drafts.push({
      sourceRef: `${artifact.storageKey}#ocr`,
      contentKind: 'ocr',
      contentText: 'OCR parser is not enabled yet; image metadata is queued for teacher review.',
      metadata: { ...baseMetadata, parser: 'ocr-placeholder-v1', pendingAdvancedParser: true },
    });
    return drafts;
  }

  if (artifact.kind === ArtifactKind.CodeArchive) {
    drafts.push({
      sourceRef: `${artifact.storageKey}#code-structure`,
      contentKind: 'code_structure',
      contentText: 'Archive static structure parser is not enabled yet; archive metadata is available for follow-up scanning.',
      metadata: { ...baseMetadata, parser: 'archive-placeholder-v1', pendingAdvancedParser: true },
    });
    return drafts;
  }

  drafts.push({
    sourceRef: `${artifact.storageKey}#advanced-parser`,
    contentKind: 'metadata',
    contentText: 'Advanced Word/PDF parser is pending; deterministic file metadata has been captured.',
    metadata: { ...baseMetadata, parser: 'advanced-parser-placeholder-v1', pendingAdvancedParser: true },
  });

  return drafts;
}

export function readParserMaxTextChars() {
  const configured = Number(process.env.PARSER_MAX_TEXT_CHARS ?? defaultMaxTextChars);
  if (!Number.isFinite(configured) || configured <= 0) {
    throw new Error('PARSER_MAX_TEXT_CHARS must be a positive number');
  }
  return Math.floor(configured);
}

function isTextLikeArtifact(artifact: ArtifactForParsing) {
  const extension = path.extname(artifact.originalName).toLowerCase();
  const mimeType = artifact.mimeType?.toLowerCase() ?? '';
  return artifact.kind === ArtifactKind.Other && (textExtensions.has(extension) || textMimeTypes.has(mimeType) || textMimePrefixes.some((prefix) => mimeType.startsWith(prefix)));
}

function decodeText(buffer: Buffer, maxTextChars: number) {
  const text = Array.from(buffer.toString('utf8'))
    .filter((char) => char !== '\u0000')
    .join('');
  return text.length > maxTextChars ? text.slice(0, maxTextChars) : text;
}
