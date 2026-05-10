import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const releaseDir = path.join(rootDir, 'release');
const runtimeDir = path.join(releaseDir, 'runtime');
const runtimeApiDir = path.join(runtimeDir, 'api');
const runtimeWebDir = path.join(runtimeDir, 'web');
const rootManifest = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const shortSha = resolveShortSha();

const requiredFiles = [
  path.join(rootDir, 'apps', 'api', 'dist', 'main.js'),
  path.join(rootDir, 'apps', 'api', 'dist', 'database', 'migrate.js'),
  path.join(rootDir, 'apps', 'api', 'dist', 'workers', 'all-workers.js'),
  path.join(rootDir, 'apps', 'web', 'dist', 'index.html'),
];

for (const requiredFile of requiredFiles) {
  if (!existsSync(requiredFile)) {
    throw new Error(`Missing build artifact: ${requiredFile}`);
  }
}

rmSync(runtimeDir, { recursive: true, force: true });
mkdirSync(runtimeDir, { recursive: true });

const escapedRuntimeApiDir = process.platform === 'win32' ? `"${runtimeApiDir}"` : `'${runtimeApiDir.replace(/'/g, `'\\''`)}'`;
execSync(`pnpm --filter @loongarch-b1/api deploy --legacy --prod ${escapedRuntimeApiDir}`, {
  cwd: rootDir,
  stdio: 'inherit',
});

mkdirSync(runtimeWebDir, { recursive: true });
cpSync(path.join(rootDir, 'apps', 'web', 'dist'), runtimeWebDir, { recursive: true });
cpSync(path.join(rootDir, 'scripts', 'deploy'), path.join(runtimeDir, 'scripts', 'deploy'), { recursive: true });
cpSync(path.join(rootDir, 'docs', 'DEPLOY_KYLIN_LOONGARCH.md'), path.join(runtimeDir, 'DEPLOY_KYLIN_LOONGARCH.md'));
cpSync(path.join(rootDir, '.env.example'), path.join(runtimeDir, '.env.example'));
cpSync(path.join(rootDir, 'README.md'), path.join(runtimeDir, 'README.md'));
writeRuntimePackageManifest(runtimeDir);
writeRuntimeCliScript(runtimeDir);
writeRuntimeLauncher(runtimeDir);
writeRuntimeNpmTarball(runtimeDir, shortSha);

function writeRuntimePackageManifest(targetDir) {
  const manifest = {
    name: 'loongarch-b1-runtime',
    private: false,
    version: rootManifest.version,
    description: 'Runtime bundle for loongarch-b1 deployment',
    files: ['api', 'web', 'scripts', 'bin', 'loongarch-b1', '.env.example', 'DEPLOY_KYLIN_LOONGARCH.md', 'README.md'],
    bin: {
      'loongarch-b1': './bin/loongarch-b1.js',
    },
    scripts: {
      start: 'loongarch-b1 start',
      'worker:all': 'loongarch-b1 worker:all',
      'db:migrate': 'loongarch-b1 db:migrate',
      'start:stack': 'loongarch-b1 start:stack',
      'stop:stack': 'loongarch-b1 stop:stack',
      'status:stack': 'loongarch-b1 status:stack',
    },
    engines: {
      node: '>=22 <25',
      npm: '>=10',
    },
  };

  writeFileSync(path.join(targetDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function writeRuntimeCliScript(targetDir) {
  const binDir = path.join(targetDir, 'bin');
  mkdirSync(binDir, { recursive: true });
  const cliPath = path.join(binDir, 'loongarch-b1.js');
  const cliScript = [
    '#!/usr/bin/env node',
    "const { spawnSync } = require('node:child_process');",
    "const path = require('node:path');",
    '',
    "const rootDir = path.resolve(__dirname, '..');",
    "const command = (process.argv[2] || 'start').trim();",
    'const args = process.argv.slice(3);',
    '',
    'const commandMap = new Map([',
    "  ['start', { type: 'shell', script: 'scripts/deploy/kylin-loongarch/start-stack.sh' }],",
    "  ['start:stack', { type: 'shell', script: 'scripts/deploy/kylin-loongarch/start-stack.sh' }],",
    "  ['stop', { type: 'shell', script: 'scripts/deploy/kylin-loongarch/stop-stack.sh' }],",
    "  ['stop:stack', { type: 'shell', script: 'scripts/deploy/kylin-loongarch/stop-stack.sh' }],",
    "  ['status', { type: 'shell', script: 'scripts/deploy/kylin-loongarch/status-stack.sh' }],",
    "  ['status:stack', { type: 'shell', script: 'scripts/deploy/kylin-loongarch/status-stack.sh' }],",
    "  ['worker', { type: 'node', script: 'api/dist/workers/all-workers.js' }],",
    "  ['worker:all', { type: 'node', script: 'api/dist/workers/all-workers.js' }],",
    "  ['db:migrate', { type: 'node', script: 'api/dist/database/migrate.js' }],",
    "  ['help', null],",
    "  ['--help', null],",
    "  ['-h', null],",
    ']);',
    '',
    'if (!commandMap.has(command)) {',
    '  printHelpAndExit(1, command);',
    '}',
    '',
    'const action = commandMap.get(command);',
    'if (!action) {',
    '  printHelpAndExit(0);',
    '}',
    '',
    "const env = { ...process.env, WEB_DIST_DIR: process.env.WEB_DIST_DIR || path.join(rootDir, 'web'), STORAGE_ROOT: process.env.STORAGE_ROOT || path.join(rootDir, 'storage') };",
    '',
    "if (action.type === 'node') {",
    '  const result = spawnSync(process.execPath, [path.join(rootDir, action.script), ...args], {',
    '    cwd: rootDir,',
    '    env,',
    "    stdio: 'inherit',",
    '  });',
    '  process.exit(result.status ?? 1);',
    '}',
    '',
    "if (process.platform === 'win32') {",
    "  console.error('This CLI is intended for Linux/macOS deployment targets. Use the npm scripts instead.');",
    '  process.exit(1);',
    '}',
    '',
    "const shellResult = spawnSync('bash', [path.join(rootDir, action.script), ...args], {",
    '  cwd: rootDir,',
    '  env,',
    "  stdio: 'inherit',",
    '});',
    'process.exit(shellResult.status ?? 1);',
    '',
    'function printHelpAndExit(code, invalidCommand) {',
    '  if (invalidCommand) {',
    "    console.error('Unknown command: ' + invalidCommand);",
    '  }',
    '  console.log([',
    "    'loongarch-b1 runtime CLI',",
    "    '',",
    "    'Usage:',",
    "    '  loongarch-b1 start',",
    "    '  loongarch-b1 worker:all',",
    "    '  loongarch-b1 db:migrate',",
    "    '  loongarch-b1 status',",
    "    '  loongarch-b1 stop',",
    "    '',",
    "    'Commands:',",
    "    '  start / start:stack       Start API + workers via the deployment script',",
    "    '  worker / worker:all       Start the merged worker process',",
    "    '  db:migrate                Run database migrations',",
    "    '  status / status:stack     Show process status',",
    "    '  stop / stop:stack         Stop the stack',",
    "  ].join('\\n'));",
    '  process.exit(code);',
    '}',
    '',
  ].join('\n');
  writeFileSync(cliPath, cliScript, 'utf8');
  if (process.platform !== 'win32') {
    chmodSync(cliPath, 0o755);
  }
}

function writeRuntimeLauncher(targetDir) {
  const launcherPath = path.join(targetDir, 'loongarch-b1');
  const launcherScript = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'exec node "$SCRIPT_DIR/bin/loongarch-b1.js" "$@"',
    '',
  ].join('\n');
  writeFileSync(launcherPath, launcherScript, 'utf8');
  if (process.platform !== 'win32') {
    chmodSync(launcherPath, 0o755);
  }
}

function writeRuntimeNpmTarball(targetDir, commitShortSha) {
  let packOutput;
  try {
    packOutput = execSync('npm pack --pack-destination ../bundles', {
      cwd: targetDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .at(-1);
  } catch (error) {
    throw new Error(`Failed to create runtime npm tarball: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }

  if (!packOutput) {
    throw new Error('Failed to create runtime npm tarball');
  }

  const sourcePath = path.join(releaseDir, 'bundles', packOutput);
  const targetPath = path.join(releaseDir, 'bundles', `loongarch-b1-runtime-npm-${commitShortSha}.tgz`);
  rmSync(targetPath, { force: true });
  cpSync(sourcePath, targetPath);
  if (sourcePath !== targetPath) {
    rmSync(sourcePath, { force: true });
  }
}

function resolveShortSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return `unknown-${Date.now().toString(36)}`;
  }
}
