import type { VerificationFinding } from '../domain/core';

export interface RuleCheckMetricDefinition {
  id: string;
  name: string;
  description: string;
  scoringRule: string;
  maxScore: number | string;
}

export interface RuleCheckEvidence {
  sourceRef: string;
  contentKind: string;
  contentText: string;
}

export interface RuleCheckInput {
  requirementText: string;
  metrics: RuleCheckMetricDefinition[];
  evidence: RuleCheckEvidence[];
}

export interface RuleMetricScore {
  metricId: string;
  ruleScore: number | null;
  comments: string[];
}

export interface RuleCheckResult {
  metricScores: RuleMetricScore[];
  findings: VerificationFinding[];
}

interface CoverageResult {
  matched: string[];
  missing: string[];
  total: number;
}

const maxRequirementFindings = 8;
const maxMetricTerms = 10;

const stopWords = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'this',
  'that',
  '功能',
  '要求',
  '系统',
  '进行',
  '完成',
  '实现',
  '支持',
  '需要',
  '提供',
  '用户',
  '学生',
  '教师',
  '实训',
  '项目',
]);

const logicRiskPatterns = [
  /todo/i,
  /not implemented/i,
  /placeholder/i,
  /error/i,
  /exception/i,
  /failed?/i,
  /未完成/,
  /无法运行/,
  /报错/,
  /异常/,
  /占位/,
];

const promptInjectionPatterns = [
  /ignore (all )?(previous|above) instructions/i,
  /disregard (all )?(previous|above) instructions/i,
  /system prompt/i,
  /忽略(以上|之前|所有).*指令/,
  /覆盖.*评分规则/,
];

const chineseTechnicalTerms = [
  '登录',
  '注册',
  '上传',
  '解析',
  '报告',
  '截图',
  '代码',
  '文档',
  '测试',
  '数据库',
  '接口',
  '权限',
  '审计',
  '导出',
  '报表',
  '统计',
  '评价',
  '评分',
  '步骤',
  '流程',
  '功能',
  '页面',
  '操作',
  '安全',
  '异常',
  '逻辑',
];

export function runDeterministicRuleCheck(input: RuleCheckInput): RuleCheckResult {
  const rawEvidenceText = input.evidence.map((item) => item.contentText).join('\n');
  const evidenceText = normalizeText(rawEvidenceText);
  const textEvidence = input.evidence.filter((item) => item.contentKind === 'text' || item.contentKind === 'ocr');
  const findings: VerificationFinding[] = [];

  findings.push(...checkRequirementCoverage(input.requirementText, evidenceText));
  findings.push(...checkStepCompleteness(input.requirementText, evidenceText, rawEvidenceText));
  findings.push(...checkEvidenceQuality(textEvidence));
  findings.push(...checkRiskPatterns(input.evidence));

  return {
    metricScores: input.metrics.map((metric) => scoreMetric(metric, evidenceText)),
    findings: dedupeFindings(findings),
  };
}

function scoreMetric(metric: RuleCheckMetricDefinition, evidenceText: string): RuleMetricScore {
  const terms = extractCandidateTerms(`${metric.name}\n${metric.description}\n${metric.scoringRule}`).slice(0, maxMetricTerms);
  if (terms.length === 0) {
    return {
      metricId: metric.id,
      ruleScore: null,
      comments: ['确定性规则未提取到可核查关键词，保留给 LLM 初评和教师复核。'],
    };
  }

  const coverage = calculateCoverage(terms, evidenceText);
  const parsedMaxScore = Number(metric.maxScore);
  const maxScore = Number.isFinite(parsedMaxScore) && parsedMaxScore > 0 ? parsedMaxScore : 100;
  const score = Number((Math.max(0, Math.min(1, coverage.matched.length / coverage.total)) * maxScore).toFixed(2));

  return {
    metricId: metric.id,
    ruleScore: score,
    comments: [
      `确定性规则覆盖 ${coverage.matched.length}/${coverage.total} 个关键词。`,
      coverage.missing.length > 0 ? `未匹配关键词：${coverage.missing.slice(0, 5).join('、')}` : '关键证据覆盖良好。',
    ],
  };
}

function checkRequirementCoverage(requirementText: string, evidenceText: string): VerificationFinding[] {
  const items = extractRequirementItems(requirementText);
  const findings: VerificationFinding[] = [];

  for (const item of items) {
    const terms = extractCandidateTerms(item).slice(0, maxMetricTerms);
    if (terms.length === 0) {
      continue;
    }
    const coverage = calculateCoverage(terms, evidenceText);
    if (coverage.matched.length / coverage.total < 0.35) {
      findings.push({
        type: 'requirement',
        severity: 'warning',
        evidence: `需求项证据覆盖不足：${item.slice(0, 180)}`,
        suggestion: `请补充能证明该需求项的报告、截图或代码说明；缺少关键词：${coverage.missing.slice(0, 5).join('、')}`,
      });
    }
    if (findings.length >= maxRequirementFindings) {
      break;
    }
  }

  if (items.length > 0 && findings.length === 0) {
    findings.push({
      type: 'requirement',
      severity: 'info',
      evidence: `确定性规则已检查 ${items.length} 个需求项，未发现明显缺失。`,
      suggestion: '仍需结合 LLM 初评和教师复核确认功能实现质量。',
    });
  }
  return findings;
}

function checkStepCompleteness(requirementText: string, evidenceText: string, rawEvidenceText: string): VerificationFinding[] {
  if (!/(步骤|流程|过程|step|procedure)/i.test(requirementText)) {
    return [];
  }
  const keywordMarkers = evidenceText.match(/(步骤|流程|过程|step|第[一二三四五六七八九十\d]+步)/gi) ?? [];
  const numberedMarkers = rawEvidenceText.match(/(?:^|\n)\s*(?:\d+[.)、]|[（(]?\d+[）)]|第[一二三四五六七八九十\d]+步)/gim) ?? [];
  const stepMarkers = [...keywordMarkers, ...numberedMarkers];
  if (stepMarkers.length >= 2) {
    return [
      {
        type: 'step',
        severity: 'info',
        evidence: `检测到 ${stepMarkers.length} 个步骤或流程标记。`,
        suggestion: '请教师重点核对步骤之间的先后逻辑和截图对应关系。',
      },
    ];
  }
  return [
    {
      type: 'step',
      severity: 'warning',
      evidence: '实训要求包含步骤/流程描述，但提交证据中步骤标记不足。',
      suggestion: '请学生补充完整操作步骤、关键截图和结果说明。',
    },
  ];
}

function checkEvidenceQuality(textEvidence: RuleCheckEvidence[]): VerificationFinding[] {
  const textLength = textEvidence.reduce((sum, item) => sum + normalizeText(item.contentText).length, 0);
  if (textEvidence.length === 0) {
    return [
      {
        type: 'document',
        severity: 'warning',
        evidence: '未发现可直接核查的文本或 OCR 证据。',
        suggestion: '请启用 Word/PDF/OCR 高级解析，或要求学生上传可解析的报告文本。',
      },
    ];
  }
  if (textLength < 200) {
    return [
      {
        type: 'document',
        severity: 'warning',
        evidence: `可核查文本较短，仅约 ${textLength} 个字符。`,
        suggestion: '请补充实验目标、过程、截图说明和结果分析，降低误判风险。',
      },
    ];
  }
  return [];
}

function checkRiskPatterns(evidence: RuleCheckEvidence[]): VerificationFinding[] {
  const findings: VerificationFinding[] = [];
  for (const item of evidence) {
    if (logicRiskPatterns.some((pattern) => pattern.test(item.contentText))) {
      findings.push({
        type: 'logic',
        severity: 'warning',
        evidence: `证据 ${item.sourceRef} 出现疑似未完成或运行异常描述。`,
        suggestion: '请教师核对运行结果、错误截图和修复说明，必要时要求学生重新提交。',
        sourceRef: item.sourceRef,
      });
      break;
    }
  }

  for (const item of evidence) {
    if (promptInjectionPatterns.some((pattern) => pattern.test(item.contentText))) {
      findings.push({
        type: 'security',
        severity: 'warning',
        evidence: `证据 ${item.sourceRef} 出现疑似 Prompt Injection 文本。`,
        suggestion: '系统评分规则优先，忽略上传内容中试图覆盖评价规则的指令。',
        sourceRef: item.sourceRef,
      });
      break;
    }
  }
  return findings;
}

function extractRequirementItems(requirementText: string) {
  return requirementText
    .split(/\r?\n|[；;]/)
    .map((line) => line.replace(/^\s*[-*•]?\s*(\d+[.)、]|[（(]?\d+[）)]|第[一二三四五六七八九十\d]+[项步、.])?\s*/, '').trim())
    .filter((line) => line.length >= 6)
    .slice(0, 20);
}

function extractCandidateTerms(text: string) {
  const normalized = normalizeText(text);
  const rawTerms = normalized.match(/[a-z0-9_+-]{2,}|[\p{Script=Han}]{2,}/gu) ?? [];
  const terms: string[] = [];
  const seen = new Set<string>();

  const addTerm = (term: string) => {
    const cleaned = term.trim();
    if (cleaned.length < 2 || stopWords.has(cleaned) || seen.has(cleaned)) {
      return;
    }
    seen.add(cleaned);
    terms.push(cleaned);
  };

  for (const term of rawTerms) {
    if (/^[\p{Script=Han}]+$/u.test(term) && term.length > 3) {
      let addedTechnicalTerm = false;
      for (const technicalTerm of chineseTechnicalTerms) {
        if (term.includes(technicalTerm)) {
          addTerm(technicalTerm);
          addedTechnicalTerm = true;
        }
      }
      if (!addedTechnicalTerm) {
        for (let index = 0; index < term.length - 1; index += 1) {
          addTerm(term.slice(index, index + 2));
        }
      }
      continue;
    }
    addTerm(term);
  }
  return terms;
}

function calculateCoverage(terms: string[], evidenceText: string): CoverageResult {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    if (evidenceText.includes(term)) {
      matched.push(term);
    } else {
      missing.push(term);
    }
  }
  return {
    matched,
    missing,
    total: terms.length || 1,
  };
}

function dedupeFindings(findings: VerificationFinding[]) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.type}:${finding.severity}:${finding.evidence}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
