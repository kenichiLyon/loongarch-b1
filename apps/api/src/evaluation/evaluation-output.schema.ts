import type { VerificationFinding } from '../domain/core';

export interface EvaluationMetricDefinition {
  id: string;
  name: string;
  maxScore: number | string;
}

export interface EvaluationMetricDraft {
  metricId: string;
  aiScore: number | null;
  confidence: number | null;
  comments: string[];
}

export interface EvaluationDraft {
  totalAiScore: number | null;
  summary: string;
  metricScores: EvaluationMetricDraft[];
  findings: VerificationFinding[];
}

const findingTypes = new Set(['requirement', 'step', 'logic', 'security', 'document', 'code']);
const findingSeverities = new Set(['info', 'warning', 'critical']);

export function validateEvaluationDraft(raw: unknown, metrics: EvaluationMetricDefinition[]): EvaluationDraft {
  if (!isRecord(raw)) {
    throw new Error('Evaluation output must be a JSON object');
  }

  const metricMap = new Map(metrics.map((metric) => [metric.id, Number(metric.maxScore)]));
  const metricScores = readMetricScores(raw.metricScores, metricMap);
  const findings = readFindings(raw.findings);
  const totalAiScore = readNullableScore(raw.totalAiScore ?? raw.totalScore, 100, 'totalAiScore');

  return {
    totalAiScore,
    summary: typeof raw.summary === 'string' ? raw.summary.slice(0, 2000) : '',
    metricScores,
    findings,
  };
}

export function buildSkippedEvaluationDraft(metrics: EvaluationMetricDefinition[], reason: string): EvaluationDraft {
  return {
    totalAiScore: null,
    summary: reason,
    metricScores: metrics.map((metric) => ({
      metricId: metric.id,
      aiScore: null,
      confidence: null,
      comments: [reason],
    })),
    findings: [
      {
        type: 'document',
        severity: 'info',
        evidence: reason,
        suggestion: '请教师进行人工复核，或配置 LLM_BASE_URL 与 LLM_MODEL 后重新入队评价任务。',
      },
    ],
  };
}

function readMetricScores(value: unknown, metricMap: Map<string, number>) {
  if (!Array.isArray(value)) {
    throw new Error('metricScores must be an array');
  }

  const seen = new Set<string>();
  return value.map((entry, index): EvaluationMetricDraft => {
    if (!isRecord(entry)) {
      throw new Error(`metricScores[${index}] must be an object`);
    }
    if (typeof entry.metricId !== 'string' || !metricMap.has(entry.metricId)) {
      throw new Error(`metricScores[${index}].metricId is unknown`);
    }
    if (seen.has(entry.metricId)) {
      throw new Error(`metricScores[${index}].metricId is duplicated`);
    }
    seen.add(entry.metricId);

    const maxScore = metricMap.get(entry.metricId) ?? 100;
    return {
      metricId: entry.metricId,
      aiScore: readScore(entry.aiScore ?? entry.score, maxScore, `metricScores[${index}].aiScore`),
      confidence: readNullableConfidence(entry.confidence, `metricScores[${index}].confidence`),
      comments: readComments(entry.comments),
    };
  });
}

function readFindings(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('findings must be an array');
  }

  return value.map((entry, index): VerificationFinding => {
    if (!isRecord(entry)) {
      throw new Error(`findings[${index}] must be an object`);
    }
    if (typeof entry.type !== 'string' || !findingTypes.has(entry.type)) {
      throw new Error(`findings[${index}].type is invalid`);
    }
    if (typeof entry.severity !== 'string' || !findingSeverities.has(entry.severity)) {
      throw new Error(`findings[${index}].severity is invalid`);
    }
    if (typeof entry.evidence !== 'string' || !entry.evidence.trim()) {
      throw new Error(`findings[${index}].evidence is required`);
    }
    if (typeof entry.suggestion !== 'string' || !entry.suggestion.trim()) {
      throw new Error(`findings[${index}].suggestion is required`);
    }

    return {
      type: entry.type as VerificationFinding['type'],
      severity: entry.severity as VerificationFinding['severity'],
      evidence: entry.evidence.slice(0, 2000),
      suggestion: entry.suggestion.slice(0, 2000),
      sourceRef: typeof entry.sourceRef === 'string' ? entry.sourceRef.slice(0, 500) : undefined,
    };
  });
}

function readScore(value: unknown, maxScore: number, field: string) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > maxScore) {
    throw new Error(`${field} must be between 0 and ${maxScore}`);
  }
  return Number(score.toFixed(2));
}

function readNullableScore(value: unknown, maxScore: number, field: string) {
  if (value === null || value === undefined) {
    return null;
  }
  return readScore(value, maxScore, field);
}

function readNullableConfidence(value: unknown, field: string) {
  if (value === null || value === undefined) {
    return null;
  }
  const confidence = Number(value);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`${field} must be between 0 and 1`);
  }
  return Number(confidence.toFixed(4));
}

function readComments(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((comment): comment is string => typeof comment === 'string').map((comment) => comment.slice(0, 1000));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
