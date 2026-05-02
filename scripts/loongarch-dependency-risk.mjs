#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultLockfile = path.join(repoRoot, 'pnpm-lock.yaml');

const nativeNamePatterns = [
  /(^|[/@-])esbuild($|[@/-])/i,
  /(^|[/@-])rollup($|[@/-])/i,
  /node-gyp/i,
  /prebuild/i,
  /sharp/i,
  /canvas/i,
  /sqlite3/i,
  /better-sqlite3/i,
  /bcrypt/i,
  /swc/i,
  /lightningcss/i,
  /playwright/i,
  /puppeteer/i,
  /fsevents/i,
];

const runtimeCriticalPatterns = [/^pg@/i, /^multer@/i, /^@nestjs\//i, /^vue@/i, /^vite@/i, /^typescript@/i];

export async function scanLockfile(lockfilePath = defaultLockfile) {
  const text = await readFile(lockfilePath, 'utf8');
  return analyzeLockfile(text);
}

export function analyzeLockfile(text) {
  const packages = parsePackageBlocks(text);
  const risks = packages.flatMap((entry) => analyzePackage(entry));
  return {
    generatedAt: new Date().toISOString(),
    packageCount: packages.length,
    risks,
    summary: summarizeRisks(risks),
  };
}

export function parsePackageBlocks(text) {
  const lines = text.split(/\r?\n/);
  const packagesStart = lines.findIndex((line) => line === 'packages:');
  if (packagesStart < 0) {
    return [];
  }

  const blocks = [];
  let current = null;

  for (const line of lines.slice(packagesStart + 1)) {
    const packageMatch = line.match(/^ {2}('?[^ ].+?'?):\s*$/);
    if (packageMatch) {
      if (current) {
        blocks.push(current);
      }
      current = { key: packageMatch[1].replace(/^'|'$/g, ''), body: [] };
      continue;
    }

    if (current) {
      if (/^\S/.test(line) && line.trim() !== '') {
        break;
      }
      current.body.push(line);
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

export function analyzePackage(entry) {
  const body = entry.body.join('\n');
  const cpu = readInlineList(body, 'cpu');
  const os = readInlineList(body, 'os');
  const reasons = [];
  const packageName = normalizePackageName(entry.key);
  const nativeNameMatch = nativeNamePatterns.some((pattern) => pattern.test(entry.key));
  const hasBuildScript = /requiresBuild:\s*true/.test(body);
  const hasCliBinary = /hasBin:\s*true/.test(body);
  const hasOptionalDependencies = /optionalDependencies:/.test(body);

  if (cpu.length > 0) {
    reasons.push(`cpu filter: ${cpu.join(', ')}`);
  }
  if (os.length > 0) {
    reasons.push(`os filter: ${os.join(', ')}`);
  }
  if (hasBuildScript) {
    reasons.push('requires install/build script');
  }
  if (hasCliBinary) {
    reasons.push('ships CLI binary');
  }
  if (hasOptionalDependencies) {
    reasons.push('has optional dependencies');
  }
  if (nativeNameMatch) {
    reasons.push('known native or platform-sensitive package family');
  }

  if (reasons.length === 0) {
    return [];
  }

  return [
    {
      packageName,
      key: entry.key,
      severity: classifySeverity({
        cpu,
        os,
        key: entry.key,
        packageName,
        nativeNameMatch,
        hasBuildScript,
        hasCliBinary,
        hasOptionalDependencies,
      }),
      reasons,
      recommendation: buildRecommendation({ cpu, os, key: entry.key, packageName, hasCliBinary }),
    },
  ];
}

export function renderMarkdownReport(scan) {
  const lines = [
    '# LoongArch 依赖风险扫描报告',
    '',
    `生成时间：${scan.generatedAt}`,
    '',
    '## 摘要',
    '',
    `- 扫描包数量：${scan.packageCount}`,
    `- 高风险：${scan.summary.high}`,
    `- 中风险：${scan.summary.medium}`,
    `- 低风险：${scan.summary.low}`,
    '',
    '## 风险列表',
    '',
    '| 等级 | 包 | 触发原因 | 建议 |',
    '| --- | --- | --- | --- |',
  ];

  for (const risk of [...scan.risks].sort(compareRisks)) {
    lines.push(`| ${risk.severity} | \`${risk.key}\` | ${escapePipe(risk.reasons.join('; '))} | ${escapePipe(risk.recommendation)} |`);
  }

  lines.push(
    '',
    '## 处理原则',
    '',
    '- `high`：进入核心运行链路前必须在 LoongArch + 银河麒麟上验证或替换。',
    '- `medium`：通常是构建工具、可选平台包或 CLI，需要在 CI/目标环境构建演练中确认。',
    '- `low`：多为已包含 LoongArch 平台条目或纯 JS CLI，记录即可，随版本升级复查。',
    '',
    '本报告由 `pnpm risk:loongarch` 生成。',
  );

  return `${lines.join('\n')}\n`;
}

function summarizeRisks(risks) {
  return {
    high: risks.filter((risk) => risk.severity === 'high').length,
    medium: risks.filter((risk) => risk.severity === 'medium').length,
    low: risks.filter((risk) => risk.severity === 'low').length,
  };
}

function classifySeverity({ cpu, os, key, packageName, nativeNameMatch, hasBuildScript, hasCliBinary, hasOptionalDependencies }) {
  const hasLoong64 = cpu.includes('loong64') || /linux-loong64/i.test(key);
  const hasLinux = os.length === 0 || os.includes('linux');
  const runtimeCritical = runtimeCriticalPatterns.some((pattern) => pattern.test(packageName));

  if (hasLoong64) {
    return 'low';
  }
  if (os.length > 0 && !hasLinux) {
    return 'low';
  }
  if (cpu.length > 0 && !hasLoong64 && hasLinux && runtimeCritical) {
    return 'high';
  }
  if (cpu.length > 0 && !hasLoong64 && hasLinux) {
    return 'medium';
  }
  if (hasBuildScript || hasOptionalDependencies || nativeNameMatch) {
    return 'medium';
  }
  if (hasCliBinary) {
    return 'low';
  }
  return 'low';
}

function buildRecommendation({ cpu, os, key, packageName, hasCliBinary }) {
  if (/linux-loong64/i.test(key) || cpu.includes('loong64')) {
    return '已出现 LoongArch/loong64 平台条目，目标环境仍需执行 frozen install 和构建验证。';
  }
  if (os.length > 0 && !os.includes('linux')) {
    return '非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。';
  }
  if (cpu.length > 0 || os.length > 0) {
    return '平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。';
  }
  if (/^pg@|^multer@|^@nestjs\//i.test(packageName)) {
    return '核心运行依赖；优先保持纯 JS 路径，并在目标环境执行接口冒烟测试。';
  }
  if (hasCliBinary) {
    return 'CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。';
  }
  return '记录为平台敏感依赖；升级或引入核心链路前在 LoongArch + 银河麒麟上复测。';
}

function normalizePackageName(key) {
  const withoutPeerSuffix = key.split('(')[0];
  const atIndex = withoutPeerSuffix.startsWith('@') ? withoutPeerSuffix.indexOf('@', 1) : withoutPeerSuffix.indexOf('@');
  return atIndex > 0 ? withoutPeerSuffix.slice(0, atIndex) : withoutPeerSuffix;
}

function readInlineList(body, field) {
  const match = body.match(new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`));
  if (!match) {
    return [];
  }
  return match[1]
    .split(',')
    .map((value) => value.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}

function compareRisks(left, right) {
  const order = { high: 0, medium: 1, low: 2 };
  return order[left.severity] - order[right.severity] || left.key.localeCompare(right.key);
}

function escapePipe(value) {
  return value.replace(/\|/g, '\\|');
}

async function main() {
  const writeIndex = process.argv.indexOf('--write');
  const outputPath = writeIndex >= 0 ? process.argv[writeIndex + 1] : undefined;
  const scan = await scanLockfile(defaultLockfile);
  const report = renderMarkdownReport(scan);

  if (outputPath) {
    await writeFile(path.resolve(repoRoot, outputPath), report, 'utf8');
  }

  console.log(`LoongArch dependency risk scan: ${scan.packageCount} packages, ${scan.summary.high} high, ${scan.summary.medium} medium, ${scan.summary.low} low`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
