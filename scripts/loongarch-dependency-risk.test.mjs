import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeLockfile, parsePackageBlocks, renderMarkdownReport } from './loongarch-dependency-risk.mjs';

const lockfile = `lockfileVersion: '9.0'

packages:

  '@esbuild/linux-loong64@0.27.7':
    resolution: {integrity: sha512-demo}
    engines: {node: '>=18'}
    cpu: [loong64]
    os: [linux]

  'sharp@1.0.0':
    resolution: {integrity: sha512-demo}
    requiresBuild: true
    optionalDependencies:
      node-addon-api: 1.0.0

  '@babel/parser@1.0.0':
    resolution: {integrity: sha512-demo}
    hasBin: true

snapshots:
`;

test('parses package blocks from pnpm lockfile packages section', () => {
  const blocks = parsePackageBlocks(lockfile);

  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].key, '@esbuild/linux-loong64@0.27.7');
});

test('classifies loong64 platform package as low risk and native build package as medium risk', () => {
  const scan = analyzeLockfile(lockfile);

  assert.equal(scan.summary.low, 2);
  assert.equal(scan.summary.medium, 1);
});

test('renders markdown report with risk table', () => {
  const report = renderMarkdownReport(analyzeLockfile(lockfile));

  assert.match(report, /LoongArch 依赖风险扫描报告/);
  assert.match(report, /@esbuild\/linux-loong64@0.27.7/);
});
