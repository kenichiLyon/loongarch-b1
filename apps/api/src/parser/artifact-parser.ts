import { inflateRawSync, inflateSync, gunzipSync } from 'node:zlib';
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

interface ZipEntry {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  data: Buffer;
}

const defaultMaxTextChars = 60_000;
const textExtensions = new Set(['.txt', '.md', '.json', '.csv']);
const textMimePrefixes = ['text/'];
const textMimeTypes = new Set(['application/json']);

export function extractArtifactContents(
  artifact: ArtifactForParsing,
  buffer: Buffer,
  maxTextChars = readParserMaxTextChars(),
): ExtractedContentDraft[] {
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
    drafts.push(buildImageMetadataDraft(artifact, buffer, baseMetadata));
    return drafts;
  }

  if (artifact.kind === ArtifactKind.CodeArchive) {
    drafts.push(buildArchiveDraft(artifact, buffer, baseMetadata, maxTextChars));
    return drafts;
  }

  if (artifact.kind === ArtifactKind.Word) {
    drafts.push(...buildWordDrafts(artifact, buffer, baseMetadata, maxTextChars));
    return drafts;
  }

  if (artifact.kind === ArtifactKind.Pdf) {
    drafts.push(...buildPdfDrafts(artifact, buffer, baseMetadata, maxTextChars));
    return drafts;
  }

  drafts.push({
    sourceRef: `${artifact.storageKey}#advanced-parser`,
    contentKind: 'metadata',
    contentText: 'Advanced parser is pending; deterministic file metadata has been captured.',
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

function buildImageMetadataDraft(artifact: ArtifactForParsing, buffer: Buffer, baseMetadata: Record<string, unknown>): ExtractedContentDraft {
  const imageInfo = readImageInfo(buffer, artifact.originalName, artifact.mimeType);
  return {
    sourceRef: `${artifact.storageKey}#image-metadata`,
    contentKind: 'metadata',
    contentText: imageInfo
      ? `Image metadata: format=${imageInfo.format}, width=${imageInfo.width}, height=${imageInfo.height}. OCR is not enabled yet.`
      : 'Image metadata is available; OCR is not enabled yet and the dimensions could not be determined.',
    metadata: {
      ...baseMetadata,
      parser: imageInfo ? 'image-metadata-v1' : 'image-metadata-fallback-v1',
      width: imageInfo?.width ?? null,
      height: imageInfo?.height ?? null,
      format: imageInfo?.format ?? inferImageFormat(artifact.originalName, artifact.mimeType),
      pendingOcr: true,
    },
  };
}

function buildArchiveDraft(
  artifact: ArtifactForParsing,
  buffer: Buffer,
  baseMetadata: Record<string, unknown>,
  maxTextChars: number,
): ExtractedContentDraft {
  const extension = path.extname(artifact.originalName).toLowerCase();
  const parsedArchive = readArchiveEntries(buffer, extension, artifact.mimeType);
  if (!parsedArchive) {
    return {
      sourceRef: `${artifact.storageKey}#code-structure`,
      contentKind: 'code_structure',
      contentText: 'Archive parser could not determine the file list; archive metadata is available for teacher review.',
      metadata: { ...baseMetadata, parser: 'archive-fallback-v1', pendingAdvancedParser: true },
    };
  }

  const fileCount = parsedArchive.entries.filter((entry) => !entry.endsWith('/')).length;
  const directoryCount = parsedArchive.entries.length - fileCount;
  const extensionCounts = summarizeExtensions(parsedArchive.entries);
  const listedEntries = parsedArchive.entries.slice(0, 50);
  const lines = [
    `Archive format: ${parsedArchive.format}`,
    `Files: ${fileCount}`,
    `Directories: ${directoryCount}`,
  ];
  if (listedEntries.length > 0) {
    lines.push(`Entries: ${listedEntries.join(', ')}`);
  }
  if (extensionCounts.length > 0) {
    lines.push(`Extensions: ${extensionCounts.map((item) => `${item.extension}=${item.count}`).join(', ')}`);
  }

  return {
    sourceRef: `${artifact.storageKey}#code-structure`,
    contentKind: 'code_structure',
    contentText: truncateText(lines.join('\n'), maxTextChars),
    metadata: {
      ...baseMetadata,
      parser: `archive-${parsedArchive.format}-v1`,
      archiveFormat: parsedArchive.format,
      fileCount,
      directoryCount,
      truncated: parsedArchive.entries.length > listedEntries.length,
      extensionCounts,
    },
  };
}

function buildWordDrafts(
  artifact: ArtifactForParsing,
  buffer: Buffer,
  baseMetadata: Record<string, unknown>,
  maxTextChars: number,
): ExtractedContentDraft[] {
  const extension = path.extname(artifact.originalName).toLowerCase();
  if (extension !== '.docx') {
    return [
      {
        sourceRef: `${artifact.storageKey}#word-parser`,
        contentKind: 'metadata',
        contentText: 'Legacy .doc parsing is not enabled; deterministic file metadata has been captured.',
        metadata: { ...baseMetadata, parser: 'word-doc-placeholder-v1', pendingAdvancedParser: true },
      },
    ];
  }

  const zipEntries = readZipEntries(buffer);
  const xmlTexts = zipEntries
    .filter((entry) => entry.fileName === 'word/document.xml' || /^word\/(header|footer)[0-9]*\.xml$/.test(entry.fileName))
    .map((entry) => extractDocxXmlText(entry.data))
    .filter((text) => text.trim().length > 0);

  if (xmlTexts.length === 0) {
    return [
      {
        sourceRef: `${artifact.storageKey}#word-parser`,
        contentKind: 'metadata',
        contentText: 'DOCX structure was read, but no textual content was extracted.',
        metadata: { ...baseMetadata, parser: 'docx-zip-v1', pendingAdvancedParser: true },
      },
    ];
  }

  const contentText = truncateText(xmlTexts.join('\n\n'), maxTextChars);
  return [
    {
      sourceRef: `${artifact.storageKey}#text`,
      contentKind: 'text',
      contentText,
      metadata: {
        ...baseMetadata,
        parser: 'docx-zip-v1',
        truncated: contentText.length >= maxTextChars,
        extractedParts: xmlTexts.length,
      },
    },
  ];
}

function buildPdfDrafts(
  artifact: ArtifactForParsing,
  buffer: Buffer,
  baseMetadata: Record<string, unknown>,
  maxTextChars: number,
): ExtractedContentDraft[] {
  const extractedText = extractPdfText(buffer, maxTextChars);
  if (!extractedText) {
    return [
      {
        sourceRef: `${artifact.storageKey}#pdf-parser`,
        contentKind: 'metadata',
        contentText: 'PDF structure was read, but no text stream could be deterministically extracted.',
        metadata: { ...baseMetadata, parser: 'pdf-basic-v1', pendingAdvancedParser: true },
      },
    ];
  }

  return [
    {
      sourceRef: `${artifact.storageKey}#text`,
      contentKind: 'text',
      contentText: extractedText,
      metadata: {
        ...baseMetadata,
        parser: 'pdf-basic-v1',
        truncated: extractedText.length >= maxTextChars,
      },
    },
  ];
}

function isTextLikeArtifact(artifact: ArtifactForParsing) {
  const extension = path.extname(artifact.originalName).toLowerCase();
  const mimeType = artifact.mimeType?.toLowerCase() ?? '';
  return (
    artifact.kind === ArtifactKind.Other &&
    (textExtensions.has(extension) || textMimeTypes.has(mimeType) || textMimePrefixes.some((prefix) => mimeType.startsWith(prefix)))
  );
}

function decodeText(buffer: Buffer, maxTextChars: number) {
  const text = Array.from(buffer.toString('utf8'))
    .filter((char) => char !== '\u0000')
    .join('');
  return truncateText(text, maxTextChars);
}

function truncateText(value: string, maxTextChars: number) {
  return value.length > maxTextChars ? value.slice(0, maxTextChars) : value;
}

function readImageInfo(buffer: Buffer, originalName: string, mimeType: string | null) {
  const format = inferImageFormat(originalName, mimeType);
  if (format === 'png' && buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (format === 'jpeg') {
    const size = readJpegSize(buffer);
    if (size) {
      return { format, ...size };
    }
  }

  if (format === 'webp' && buffer.length >= 30 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    const size = readWebpSize(buffer);
    if (size) {
      return { format, ...size };
    }
  }

  return null;
}

function inferImageFormat(originalName: string, mimeType: string | null) {
  const extension = path.extname(originalName).toLowerCase();
  if (extension === '.png' || mimeType === 'image/png') {
    return 'png';
  }
  if (extension === '.jpg' || extension === '.jpeg' || mimeType === 'image/jpeg') {
    return 'jpeg';
  }
  if (extension === '.webp' || mimeType === 'image/webp') {
    return 'webp';
  }
  return 'unknown';
}

function readJpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const markerSize = buffer.readUInt16BE(offset + 2);
    if (markerSize < 2 || offset + markerSize + 2 > buffer.length) {
      return null;
    }
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += markerSize + 2;
  }
  return null;
}

function readWebpSize(buffer: Buffer) {
  const chunkType = buffer.subarray(12, 16).toString('ascii');
  if (chunkType === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  return null;
}

function readArchiveEntries(buffer: Buffer, extension: string, mimeType: string | null) {
  if (extension === '.zip') {
    return {
      format: 'zip',
      entries: readZipEntries(buffer).map((entry) => normalizeArchivePath(entry.fileName)),
    };
  }

  if (extension === '.tar') {
    return {
      format: 'tar',
      entries: readTarEntries(buffer),
    };
  }

  if (extension === '.tgz' || extension === '.gz' || mimeType === 'application/gzip' || mimeType === 'application/x-gzip') {
    try {
      const inflated = gunzipSync(buffer);
      return {
        format: extension === '.tgz' ? 'tgz' : 'gz-tar',
        entries: readTarEntries(inflated),
      };
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeArchivePath(value: string) {
  return value.replace(/\\/g, '/');
}

function summarizeExtensions(entries: string[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.endsWith('/')) {
      continue;
    }
    const extension = path.extname(entry).toLowerCase() || '(none)';
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([extension, count]) => ({ extension, count }));
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const endOfCentralDirectoryOffset = findEndOfCentralDirectory(buffer);
  if (endOfCentralDirectoryOffset < 0) {
    return [];
  }

  const totalEntries = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');
    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      data: decompressZipData(compressionMethod, compressedData, uncompressedSize),
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

function decompressZipData(compressionMethod: number, compressedData: Buffer, expectedSize: number) {
  if (compressionMethod === 0) {
    return compressedData;
  }
  if (compressionMethod === 8) {
    const inflated = inflateRawSync(compressedData);
    return expectedSize > 0 && inflated.length !== expectedSize ? inflated.subarray(0, expectedSize) : inflated;
  }
  throw new Error(`Unsupported zip compression method: ${compressionMethod}`);
}

function extractDocxXmlText(buffer: Buffer) {
  const xml = buffer.toString('utf8');
  const normalized = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n');
  const matches = normalized.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? [];
  const text = matches
    .map((segment) => segment.replace(/<\/?w:t[^>]*>/g, ''))
    .map(decodeXmlEntities)
    .join('');
  return normalizeWhitespace(text);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function readTarEntries(buffer: Buffer) {
  const entries: string[] = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const fullName = normalizeArchivePath(prefix ? `${prefix}/${rawName}` : rawName);
    const sizeRaw = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeRaw || '0', 8) || 0;
    const typeFlag = header.subarray(156, 157).toString('ascii');

    entries.push(typeFlag === '5' ? `${fullName}/` : fullName);

    const dataBlocks = Math.ceil(size / 512);
    offset += 512 + dataBlocks * 512;
  }
  return entries.filter((entry) => entry.length > 0);
}

function extractPdfText(buffer: Buffer, maxTextChars: number) {
  const latin1 = buffer.toString('latin1');
  const streamRegex = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)endstream/g;
  const texts: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(latin1)) !== null) {
    const dictionary = match[1];
    const streamText = match[2];
    const rawStream = Buffer.from(streamText, 'latin1');
    let contentBuffer = rawStream;
    if (/\/FlateDecode/.test(dictionary)) {
      try {
        contentBuffer = inflateSync(rawStream);
      } catch {
        try {
          contentBuffer = inflateRawSync(rawStream);
        } catch {
          continue;
        }
      }
    }

    const extracted = extractPdfTextOperators(contentBuffer.toString('latin1'));
    if (extracted.trim().length > 0) {
      texts.push(extracted);
    }
  }

  if (texts.length === 0) {
    return '';
  }
  return truncateText(normalizeWhitespace(texts.join('\n')), maxTextChars);
}

function extractPdfTextOperators(stream: string) {
  const pieces: string[] = [];

  for (const match of stream.matchAll(/\((?:\\.|[^\\()])*\)\s*Tj/g)) {
    const literal = match[0].replace(/\)\s*Tj$/, '');
    pieces.push(decodePdfLiteralString(literal));
  }

  for (const match of stream.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    const inner = match[1];
    const strings = inner.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
    const joined = strings.map(decodePdfLiteralString).join(' ');
    if (joined.trim().length > 0) {
      pieces.push(joined);
    }
  }

  return pieces.join('\n');
}

function decodePdfLiteralString(literal: string) {
  const inner = literal.replace(/^\(/, '').replace(/\)$/, '');
  return inner
    .replace(/\\([\\()])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}
