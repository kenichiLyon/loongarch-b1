import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
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

test('extracts docx text from stored zip content', () => {
  const xml = '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>hello</w:t></w:r></w:p><w:p><w:r><w:t>world</w:t></w:r></w:p></w:body></w:document>';
  const buffer = buildZip([
    { name: '[Content_Types].xml', data: '<Types></Types>' },
    { name: 'word/document.xml', data: xml },
  ]);

  const drafts = extractArtifactContents(
    {
      id: 'artifact-docx',
      kind: ArtifactKind.Word,
      originalName: 'report.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: buffer.byteLength,
      sha256: 'hash',
      storageKey: 'artifacts/demo/report.docx',
    },
    buffer,
    200,
  );

  assert.equal(drafts[1].contentKind, 'text');
  assert.match(drafts[1].contentText, /hello/);
  assert.match(drafts[1].contentText, /world/);
  assert.equal(drafts[1].metadata.parser, 'docx-zip-v1');
});

test('extracts text from a simple pdf content stream', () => {
  const stream = Buffer.from('BT (Hello PDF) Tj ET', 'latin1');
  const pdf = Buffer.from(`%PDF-1.4
1 0 obj
<< /Length ${stream.byteLength} >>
stream
${stream.toString('latin1')}
endstream
endobj
%%EOF`, 'latin1');

  const drafts = extractArtifactContents(
    {
      id: 'artifact-pdf',
      kind: ArtifactKind.Pdf,
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: pdf.byteLength,
      sha256: 'hash',
      storageKey: 'artifacts/demo/report.pdf',
    },
    pdf,
    200,
  );

  assert.equal(drafts[1].contentKind, 'text');
  assert.match(drafts[1].contentText, /Hello PDF/);
  assert.equal(drafts[1].metadata.parser, 'pdf-basic-v1');
});

test('extracts archive structure from zip content', () => {
  const buffer = buildZip([
    { name: 'src/index.ts', data: 'console.log("hi")', compression: 'deflate' },
    { name: 'README.md', data: '# demo' },
    { name: 'assets/', data: '' },
  ]);

  const drafts = extractArtifactContents(
    {
      id: 'artifact-zip',
      kind: ArtifactKind.CodeArchive,
      originalName: 'project.zip',
      mimeType: 'application/zip',
      sizeBytes: buffer.byteLength,
      sha256: 'hash',
      storageKey: 'artifacts/demo/project.zip',
    },
    buffer,
    500,
  );

  assert.equal(drafts[1].contentKind, 'code_structure');
  assert.match(drafts[1].contentText, /src\/index\.ts/);
  assert.match(drafts[1].contentText, /README\.md/);
  assert.equal(drafts[1].metadata.archiveFormat, 'zip');
});

test('extracts image dimensions from png metadata', () => {
  const png = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13,
    73, 72, 68, 82,
    0, 0, 0, 1,
    0, 0, 0, 2,
    8, 2, 0, 0, 0,
    0, 0, 0, 0,
  ]);

  const drafts = extractArtifactContents(
    {
      id: 'artifact-png',
      kind: ArtifactKind.Image,
      originalName: 'screen.png',
      mimeType: 'image/png',
      sizeBytes: png.byteLength,
      sha256: 'hash',
      storageKey: 'artifacts/demo/screen.png',
    },
    png,
    100,
  );

  assert.equal(drafts[1].contentKind, 'metadata');
  assert.equal(drafts[1].metadata.width, 1);
  assert.equal(drafts[1].metadata.height, 2);
});

test('extracts repository metadata from git link payload', () => {
  const buffer = Buffer.from(
    JSON.stringify({
      url: 'https://github.com/example-org/teaching-demo/tree/main/src',
      branch: 'main',
      commitSha: '0123456789abcdef0',
    }),
    'utf8',
  );

  const drafts = extractArtifactContents(
    {
      id: 'artifact-git',
      kind: ArtifactKind.GitLink,
      originalName: 'example-org-teaching-demo.gitlink.json',
      mimeType: 'application/json',
      sizeBytes: buffer.byteLength,
      sha256: 'hash',
      storageKey: 'artifacts/demo/example-org-teaching-demo.gitlink.json',
    },
    buffer,
    300,
  );

  assert.equal(drafts[1].contentKind, 'code_structure');
  assert.match(drafts[1].contentText, /github/);
  assert.match(drafts[1].contentText, /example-org/);
  assert.match(drafts[1].contentText, /teaching-demo/);
  assert.equal(drafts[1].metadata.parser, 'git-link-v1');
  assert.equal(drafts[1].metadata.branch, 'main');
});

test('keeps fallback metadata for unsupported legacy word files', () => {
  const drafts = extractArtifactContents(
    {
      id: 'artifact-doc',
      kind: ArtifactKind.Word,
      originalName: 'legacy.doc',
      mimeType: 'application/msword',
      sizeBytes: 10,
      sha256: 'hash',
      storageKey: 'artifacts/demo/legacy.doc',
    },
    Buffer.from('binary-doc'),
    100,
  );

  assert.equal(drafts[1].metadata.pendingAdvancedParser, true);
  assert.equal(drafts[1].metadata.parser, 'word-doc-placeholder-v1');
});

function buildZip(entries: Array<{ name: string; data: string; compression?: 'store' | 'deflate' }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const source = Buffer.from(entry.data, 'utf8');
    const compressionMethod = entry.compression === 'deflate' ? 8 : 0;
    const compressed = compressionMethod === 8 ? deflateRawSync(source) : source;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(compressed.byteLength, 18);
    localHeader.writeUInt32LE(source.byteLength, 22);
    localHeader.writeUInt16LE(nameBuffer.byteLength, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressed.byteLength, 20);
    centralHeader.writeUInt32LE(source.byteLength, 24);
    centralHeader.writeUInt16LE(nameBuffer.byteLength, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(entry.name.endsWith('/') ? 16 : 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    const localPart = Buffer.concat([localHeader, nameBuffer, compressed]);
    const centralPart = Buffer.concat([centralHeader, nameBuffer]);
    localParts.push(localPart);
    centralParts.push(centralPart);
    localOffset += localPart.byteLength;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.byteLength, 12);
  endOfCentralDirectory.writeUInt32LE(localOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}
