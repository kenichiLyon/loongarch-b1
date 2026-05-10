import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const releaseDir = path.join(rootDir, 'release');
const runtimeDir = path.join(releaseDir, 'runtime');
const runtimeApiDir = path.join(runtimeDir, 'api');
const runtimeWebDir = path.join(runtimeDir, 'web');
const rootManifest = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

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

function writeRuntimePackageManifest(targetDir) {
  const manifest = {
    name: 'loongarch-b1-runtime',
    private: true,
    version: rootManifest.version,
    description: 'Runtime bundle for loongarch-b1 deployment',
    scripts: {
      start: 'node api/dist/main.js',
      'worker:all': 'node api/dist/workers/all-workers.js',
      'db:migrate': 'node api/dist/database/migrate.js',
      'start:stack': 'bash scripts/deploy/kylin-loongarch/start-stack.sh',
      'stop:stack': 'bash scripts/deploy/kylin-loongarch/stop-stack.sh',
      'status:stack': 'bash scripts/deploy/kylin-loongarch/status-stack.sh',
    },
    engines: {
      node: '>=22 <25',
      npm: '>=10',
    },
  };

  writeFileSync(path.join(targetDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
