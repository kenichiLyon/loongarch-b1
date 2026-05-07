import { Injectable } from '@nestjs/common';
import type { RuleCheckResult } from './rule-checker';
import { readEvaluationMaxContextChars, redactSensitiveText } from '../llm/redaction';

export interface EvaluationContextArtifact {
  id: string;
  kind: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: string | number;
  sha256: string | null;
  storageKey: string;
  status: string;
}

export interface EvaluationContextEvidence {
  sourceRef: string;
  contentKind: string;
  contentText: string;
}

export interface EvaluationContextMetric {
  id: string;
  name: string;
  description: string;
  weight: string | number;
  maxScore: string | number;
  scoringRule: string;
  sortOrder: number;
}

export interface EvaluationContextBuilderInput {
  submission: {
    submissionId: string;
    studentId: string;
    status: string;
  };
  experiment: {
    title: string;
    requirementText: string;
  };
  rubric: {
    templateId: string;
    name: string;
    metrics: EvaluationContextMetric[];
  };
  artifacts: EvaluationContextArtifact[];
  evidence: EvaluationContextEvidence[];
  ruleCheck: RuleCheckResult;
  promptVersion: string;
  contextVersion?: string;
  maxChars?: number;
}

export interface EvaluationContextSnapshotDraft {
  promptVersion: string;
  contextVersion: string;
  contextJson: Record<string, unknown>;
  contextText: string;
  originalCharCount: number;
  redactedCharCount: number;
  truncated: boolean;
  sourceCounts: Record<string, unknown>;
}

const defaultContextVersion = 'evaluation-context-v1';

@Injectable()
export class EvaluationContextBuilderService {
  build(input: EvaluationContextBuilderInput): EvaluationContextSnapshotDraft {
    return buildEvaluationContextSnapshot(input);
  }
}

export function buildEvaluationContextSnapshot(input: EvaluationContextBuilderInput): EvaluationContextSnapshotDraft {
  const maxChars = input.maxChars ?? readEvaluationMaxContextChars();
  const contextVersion = input.contextVersion ?? readEvaluationContextVersion();
  const budgets = allocateBudgets(maxChars);
  const truncateState = { truncated: false };

  const requirement = budgetSection(input.experiment.requirementText, budgets.requirement, truncateState);
  const rubricMetrics = input.rubric.metrics.map((metric) => ({
    id: metric.id,
    name: metric.name,
    description: budgetSection(metric.description, 240, truncateState).text,
    weight: Number(metric.weight),
    maxScore: Number(metric.maxScore),
    scoringRule: budgetSection(metric.scoringRule, 320, truncateState).text,
    sortOrder: metric.sortOrder,
  }));
  const rubricLines = input.rubric.metrics.map(
    (metric) =>
      `${metric.name} [${metric.id}] weight=${metric.weight} max=${metric.maxScore} rule=${budgetSection(metric.scoringRule, 220, truncateState).text}`,
  );
  const rubricText = budgetSection(rubricLines.join('\n'), budgets.rubric, truncateState);

  const artifacts = input.artifacts.map((artifact) => ({
    id: artifact.id,
    kind: artifact.kind,
    originalName: artifact.originalName,
    mimeType: artifact.mimeType,
    sizeBytes: Number(artifact.sizeBytes),
    sha256: artifact.sha256,
    storageKey: artifact.storageKey,
    status: artifact.status,
  }));
  const artifactLines = artifacts.map(
    (artifact) =>
      `${artifact.originalName} (${artifact.kind}, status=${artifact.status}, size=${artifact.sizeBytes}, sha=${artifact.sha256?.slice(0, 12) ?? 'n/a'})`,
  );
  const artifactText = budgetSection(artifactLines.join('\n'), budgets.artifacts, truncateState);

  const ruleMetricScores = input.ruleCheck.metricScores.map((metric) => ({
    metricId: metric.metricId,
    ruleScore: metric.ruleScore,
    comments: metric.comments.map((comment) => budgetSection(comment, 220, truncateState).text),
  }));
  const ruleFindings = input.ruleCheck.findings.map((finding) => ({
    type: finding.type,
    severity: finding.severity,
    evidence: budgetSection(finding.evidence, 320, truncateState).text,
    suggestion: budgetSection(finding.suggestion, 320, truncateState).text,
    sourceRef: finding.sourceRef ?? null,
  }));
  const ruleLines = [
    ...ruleMetricScores.map((item) => `${item.metricId}: ruleScore=${item.ruleScore ?? 'n/a'} comments=${item.comments.join(' | ')}`),
    ...ruleFindings.map((finding) => `${finding.type}/${finding.severity}: ${finding.evidence} => ${finding.suggestion}`),
  ];
  const ruleText = budgetSection(ruleLines.join('\n'), budgets.ruleCheck, truncateState);

  const evidenceSections = buildEvidenceSections(input.evidence, budgets.evidence, truncateState);
  const evidenceText = budgetSection(
    evidenceSections
      .map((section) => `[${section.contentKind}]\n${section.items.map((item) => `${item.sourceRef}: ${item.contentText}`).join('\n')}`)
      .join('\n\n'),
    budgets.evidence,
    truncateState,
  );

  const contextJson = {
    contextVersion,
    submission: {
      submissionId: input.submission.submissionId,
      studentId: input.submission.studentId,
      status: input.submission.status,
    },
    experiment: {
      title: input.experiment.title,
      requirementText: requirement.text,
    },
    rubric: {
      templateId: input.rubric.templateId,
      name: input.rubric.name,
      metrics: rubricMetrics,
    },
    artifacts,
    evidenceSections,
    ruleCheck: {
      metricScores: ruleMetricScores,
      findings: ruleFindings,
    },
    redaction: {
      strategy: 'redaction-v1',
      maxChars,
    },
    budgets,
    truncated: truncateState.truncated,
  } satisfies Record<string, unknown>;

  const contextText = [
    `Submission`,
    `submissionId=${input.submission.submissionId}`,
    `studentId=${input.submission.studentId}`,
    `status=${input.submission.status}`,
    '',
    `Experiment`,
    `title=${input.experiment.title}`,
    `requirement=${requirement.text}`,
    '',
    `Rubric`,
    rubricText.text,
    '',
    `Artifacts`,
    artifactText.text,
    '',
    `Rule Check`,
    ruleText.text,
    '',
    `Evidence`,
    evidenceText.text,
  ]
    .join('\n')
    .trim();

  const originalCharCount = buildOriginalContextText(input).length;
  const redactedCharCount = contextText.length;

  return {
    promptVersion: input.promptVersion,
    contextVersion,
    contextJson: contextJson as Record<string, unknown>,
    contextText,
    originalCharCount,
    redactedCharCount,
    truncated: truncateState.truncated,
    sourceCounts: buildSourceCounts(input),
  };
}

export function readEvaluationContextVersion() {
  return (process.env.EVALUATION_CONTEXT_VERSION ?? defaultContextVersion).trim() || defaultContextVersion;
}

function allocateBudgets(maxChars: number) {
  const requirement = Math.floor(maxChars * 0.2);
  const rubric = Math.floor(maxChars * 0.1);
  const artifacts = Math.floor(maxChars * 0.05);
  const ruleCheck = Math.floor(maxChars * 0.15);
  const evidence = maxChars - requirement - rubric - artifacts - ruleCheck;
  return {
    total: maxChars,
    requirement,
    rubric,
    artifacts,
    ruleCheck,
    evidence,
  };
}

function buildEvidenceSections(
  evidence: EvaluationContextEvidence[],
  budget: number,
  truncateState: { truncated: boolean },
) {
  const groups = new Map<string, Array<{ sourceRef: string; contentText: string }>>();
  const perItemBudget = Math.max(160, Math.floor(budget / Math.max(evidence.length, 1)));

  for (const item of evidence) {
    const group = groups.get(item.contentKind) ?? [];
    group.push({
      sourceRef: item.sourceRef,
      contentText: budgetSection(item.contentText, perItemBudget, truncateState).text,
    });
    groups.set(item.contentKind, group);
  }

  return Array.from(groups.entries()).map(([contentKind, items]) => ({
    contentKind,
    itemCount: items.length,
    items,
  }));
}

function buildSourceCounts(input: EvaluationContextBuilderInput) {
  const byContentKind: Record<string, number> = {};
  for (const item of input.evidence) {
    byContentKind[item.contentKind] = (byContentKind[item.contentKind] ?? 0) + 1;
  }
  return {
    artifactCount: input.artifacts.length,
    evidenceCount: input.evidence.length,
    ruleFindingCount: input.ruleCheck.findings.length,
    byContentKind,
  };
}

function buildOriginalContextText(input: EvaluationContextBuilderInput) {
  return [
    input.submission.submissionId,
    input.submission.studentId,
    input.submission.status,
    input.experiment.title,
    input.experiment.requirementText,
    input.rubric.name,
    ...input.rubric.metrics.flatMap((metric) => [metric.name, metric.description, metric.scoringRule]),
    ...input.artifacts.flatMap((artifact) => [artifact.originalName, artifact.storageKey, artifact.sha256 ?? '']),
    ...input.ruleCheck.metricScores.flatMap((metric) => metric.comments),
    ...input.ruleCheck.findings.flatMap((finding) => [finding.evidence, finding.suggestion, finding.sourceRef ?? '']),
    ...input.evidence.map((item) => item.contentText),
  ].join('\n');
}

function budgetSection(value: string, budget: number, truncateState: { truncated: boolean }) {
  const redacted = redactSensitiveText(value);
  const text = redacted.length > budget ? redacted.slice(0, budget) : redacted;
  if (text.length < redacted.length) {
    truncateState.truncated = true;
  }
  return { text };
}
