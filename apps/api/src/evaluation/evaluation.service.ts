import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { UserRole } from '../domain/core';
import { buildLlmInputHash, LlmGatewayService, type LlmJsonResponse } from '../llm/llm-gateway.service';
import type { ReviewSubmissionDto } from './evaluation.dto';
import { buildEvaluationPrompt } from './evaluation-prompt';
import {
  buildSkippedEvaluationDraft,
  validateEvaluationDraft,
  type EvaluationDraft,
  type EvaluationMetricDefinition,
} from './evaluation-output.schema';
import { runDeterministicRuleCheck, type RuleCheckResult } from './rule-checker';

interface SubmissionEvaluationContextRow extends QueryResultRow {
  submissionId: string;
  studentId: string;
  status: string;
  experimentTitle: string;
  requirementText: string;
  rubricTemplateId: string;
  rubricName: string;
}

interface RubricMetricRow extends QueryResultRow, EvaluationMetricDefinition {
  id: string;
  name: string;
  description: string;
  weight: string;
  maxScore: string;
  scoringRule: string;
  sortOrder: number;
}

interface ExtractedContentRow extends QueryResultRow {
  sourceRef: string;
  contentKind: string;
  contentText: string;
}

interface EvaluationResultRow extends QueryResultRow {
  id: string;
  submissionId: string;
  status: string;
  totalAiScore: string | null;
  totalTeacherScore: string | null;
  finalScore: string | null;
  teacherComment: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MetricScoreRow extends QueryResultRow {
  id: string;
  rubricMetricId: string;
  metricName: string;
  ruleScore: string | null;
  aiScore: string | null;
  teacherScore: string | null;
  finalScore: string | null;
  confidence: string | null;
  comments: unknown;
}

interface EvaluationForMutationRow extends QueryResultRow {
  id: string;
  submissionId: string;
  studentId: string;
  status: string;
  finalScore: string | null;
}

interface MetricScoreForReviewRow extends QueryResultRow {
  id: string;
  rubricMetricId: string;
  metricName: string;
  weight: string;
  maxScore: string;
  ruleScore: string | null;
  aiScore: string | null;
  teacherScore: string | null;
  finalScore: string | null;
  comments: unknown;
}

interface FindingRow extends QueryResultRow {
  id: string;
  findingType: string;
  severity: string;
  evidence: string;
  suggestion: string;
  sourceRef: string | null;
  createdAt: string;
}

interface SubmissionAccessRow extends QueryResultRow {
  submissionId: string;
  studentId: string;
  status: string;
}

export interface SubmissionEvaluationContext {
  submission: SubmissionEvaluationContextRow;
  metrics: RubricMetricRow[];
  evidence: ExtractedContentRow[];
}

@Injectable()
export class EvaluationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly llmGateway: LlmGatewayService,
    private readonly auditService: AuditService,
  ) {}

  async evaluateSubmission(submissionId: string) {
    const context = await this.loadEvaluationContext(submissionId);
    const ruleCheck = runDeterministicRuleCheck({
      requirementText: context.submission.requirementText,
      metrics: context.metrics,
      evidence: context.evidence,
    });
    const prompt = buildEvaluationPrompt({
      experimentTitle: context.submission.experimentTitle,
      requirementText: context.submission.requirementText,
      metrics: context.metrics,
      evidence: context.evidence,
    });

    if (!this.llmGateway.isConfigured()) {
      const reason = 'LLM Gateway is not configured; evaluation is routed to teacher review.';
      const draft = buildSkippedEvaluationDraft(context.metrics, reason);
      await this.persistEvaluationDraft({
        context,
        draft,
        promptVersion: prompt.promptVersion,
        llmResponse: null,
        ruleCheck,
        skippedReason: reason,
      });
      return { submissionId, status: 'skipped', reason };
    }

    const inputHash = buildLlmInputHash(prompt.systemPrompt, prompt.userPrompt);
    let llmResponse: LlmJsonResponse;
    try {
      llmResponse = await this.llmGateway.requestJson({
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
      });
    } catch (error) {
      await this.recordLlmFailure(context.submission.submissionId, prompt.promptVersion, inputHash, error);
      throw error;
    }

    let draft: EvaluationDraft;
    try {
      draft = validateEvaluationDraft(llmResponse.parsedJson, context.metrics);
    } catch (error) {
      await this.recordLlmFailure(context.submission.submissionId, prompt.promptVersion, inputHash, error, llmResponse);
      throw error;
    }

    await this.persistEvaluationDraft({
      context,
      draft,
      promptVersion: prompt.promptVersion,
      llmResponse,
      ruleCheck,
    });
    return {
      submissionId,
      status: 'ai_draft',
      metricScoreCount: context.metrics.length,
      findingCount: draft.findings.length + ruleCheck.findings.length,
    };
  }

  async getEvaluation(submissionId: string): Promise<unknown> {
    await this.ensureSubmissionExists(submissionId);

    const evaluation = await this.database.query<EvaluationResultRow>(
      `SELECT id, submission_id AS "submissionId", status, total_ai_score AS "totalAiScore",
              total_teacher_score AS "totalTeacherScore", final_score AS "finalScore",
              teacher_comment AS "teacherComment", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM evaluation_results
        WHERE submission_id = $1`,
      [submissionId],
    );

    const result = evaluation.rows[0];
    if (!result) {
      return {
        submissionId,
        status: 'not_started',
        metricScores: [],
        findings: [],
      };
    }

    const metricScores = await this.database.query<MetricScoreRow>(
      `SELECT ms.id, ms.rubric_metric_id AS "rubricMetricId", rm.name AS "metricName",
              ms.rule_score AS "ruleScore", ms.ai_score AS "aiScore", ms.teacher_score AS "teacherScore",
              ms.final_score AS "finalScore", ms.confidence, ms.comments
         FROM metric_scores ms
         JOIN rubric_metrics rm ON rm.id = ms.rubric_metric_id
        WHERE ms.evaluation_result_id = $1
        ORDER BY rm.sort_order ASC, rm.created_at ASC`,
      [result.id],
    );
    const findings = await this.database.query<FindingRow>(
      `SELECT id, finding_type AS "findingType", severity, evidence, suggestion, source_ref AS "sourceRef",
              created_at AS "createdAt"
         FROM verification_findings
        WHERE evaluation_result_id = $1
        ORDER BY created_at ASC`,
      [result.id],
    );

    return {
      ...result,
      metricScores: metricScores.rows,
      findings: findings.rows,
    };
  }

  async getPublishedEvaluation(submissionId: string, user: AuthenticatedUser): Promise<unknown> {
    const submission = await this.ensureSubmissionExists(submissionId);
    if (user.role === UserRole.Student && submission.studentId !== user.id) {
      throw new ForbiddenException('Students can only view their own published feedback');
    }

    const published = await this.database.query<{ id: string }>(
      `SELECT id
         FROM evaluation_results
        WHERE submission_id = $1
          AND status = 'published'`,
      [submissionId],
    );
    if (!published.rows[0]) {
      throw new NotFoundException('Published evaluation not found');
    }

    return this.getEvaluation(submissionId);
  }

  async reviewSubmission(submissionId: string, dto: ReviewSubmissionDto, reviewer: AuthenticatedUser): Promise<unknown> {
    await this.database.withTransaction(async (client) => {
      const evaluation = await loadEvaluationForMutation(client, submissionId);
      if (evaluation.status === 'published') {
        throw new BadRequestException('Published evaluations cannot be edited');
      }

      const metrics = await loadMetricScoresForReview(client, evaluation.id);
      if (metrics.length === 0) {
        throw new BadRequestException('Evaluation has no metric scores to review');
      }

      validateTeacherMetricScores(dto.metricScores ?? [], metrics);
      for (const metricScore of dto.metricScores ?? []) {
        const existing = findMetricScore(metrics, metricScore.rubricMetricId);
        await client.query(
          `UPDATE metric_scores
              SET teacher_score = $3,
                  final_score = $3,
                  comments = $4::jsonb
            WHERE evaluation_result_id = $1
              AND rubric_metric_id = $2`,
          [
            evaluation.id,
            metricScore.rubricMetricId,
            metricScore.teacherScore,
            serializeMetricComments(parseStringArray(existing.comments), metricScore.comment ? [`教师复核：${metricScore.comment}`] : []),
          ],
        );
      }

      await client.query(
        `UPDATE metric_scores
            SET final_score = COALESCE(teacher_score, ai_score, rule_score)
          WHERE evaluation_result_id = $1`,
        [evaluation.id],
      );

      const reviewedMetrics = await loadMetricScoresForReview(client, evaluation.id);
      const finalScore = calculateWeightedFinalScore(reviewedMetrics);
      await client.query(
        `UPDATE evaluation_results
            SET status = 'teacher_reviewed',
                total_teacher_score = $2,
                final_score = $2,
                teacher_comment = COALESCE($3, teacher_comment),
                confirmed_by = $4,
                confirmed_at = now(),
                updated_at = now()
          WHERE id = $1`,
        [evaluation.id, finalScore, dto.teacherComment ?? null, reviewer.id],
      );

      await this.auditService.record({
        actorId: reviewer.id,
        action: 'submission.teacher_reviewed',
        entityType: 'submission',
        entityId: submissionId,
        detail: {
          evaluationResultId: evaluation.id,
          metricOverrideCount: dto.metricScores?.length ?? 0,
          finalScore,
        },
        client,
      });
    });

    return this.getEvaluation(submissionId);
  }

  async publishEvaluation(submissionId: string, publisher: AuthenticatedUser): Promise<unknown> {
    await this.database.withTransaction(async (client) => {
      const evaluation = await loadEvaluationForMutation(client, submissionId);
      if (evaluation.status !== 'teacher_reviewed') {
        throw new BadRequestException('Evaluation must be teacher reviewed before publishing');
      }
      if (evaluation.finalScore === null) {
        throw new BadRequestException('Evaluation has no final score to publish');
      }

      await client.query(
        `UPDATE evaluation_results
            SET status = 'published',
                published_at = now(),
                updated_at = now()
          WHERE id = $1`,
        [evaluation.id],
      );
      await client.query(
        `UPDATE submissions
            SET status = 'published',
                updated_at = now()
          WHERE id = $1`,
        [submissionId],
      );

      await this.auditService.record({
        actorId: publisher.id,
        action: 'submission.evaluation_published',
        entityType: 'submission',
        entityId: submissionId,
        detail: {
          evaluationResultId: evaluation.id,
          finalScore: Number(evaluation.finalScore),
        },
        client,
      });
    });

    return this.getEvaluation(submissionId);
  }

  private async loadEvaluationContext(submissionId: string): Promise<SubmissionEvaluationContext> {
    const submission = await this.database.query<SubmissionEvaluationContextRow>(
      `SELECT s.id AS "submissionId", s.student_id AS "studentId", s.status,
              e.title AS "experimentTitle", e.requirement_text AS "requirementText",
              rt.id AS "rubricTemplateId", rt.name AS "rubricName"
         FROM submissions s
         JOIN experiments e ON e.id = s.experiment_id
         JOIN rubric_templates rt ON rt.id = e.rubric_template_id
        WHERE s.id = $1`,
      [submissionId],
    );

    const row = submission.rows[0];
    if (!row) {
      throw new NotFoundException('Submission not found');
    }

    const metrics = await this.database.query<RubricMetricRow>(
      `SELECT id, name, description, weight, max_score AS "maxScore", scoring_rule AS "scoringRule",
              sort_order AS "sortOrder"
         FROM rubric_metrics
        WHERE rubric_template_id = $1
        ORDER BY sort_order ASC, created_at ASC`,
      [row.rubricTemplateId],
    );
    if (metrics.rows.length === 0) {
      throw new Error('Submission rubric has no metrics');
    }

    const artifactReadiness = await this.database.query<{ pendingCount: string }>(
      `SELECT COUNT(*) AS "pendingCount"
         FROM artifacts
        WHERE submission_id = $1
          AND status <> 'parsed'`,
      [submissionId],
    );
    if (Number(artifactReadiness.rows[0]?.pendingCount ?? 0) > 0) {
      throw new Error('Submission still has unparsed or failed artifacts');
    }

    const evidence = await this.database.query<ExtractedContentRow>(
      `SELECT ec.source_ref AS "sourceRef", ec.content_kind AS "contentKind", ec.content_text AS "contentText"
         FROM extracted_contents ec
         JOIN artifacts a ON a.id = ec.artifact_id
        WHERE a.submission_id = $1
        ORDER BY a.created_at ASC, ec.created_at ASC`,
      [submissionId],
    );
    if (evidence.rows.length === 0) {
      throw new Error('Submission has no extracted evidence for evaluation');
    }

    return {
      submission: row,
      metrics: metrics.rows,
      evidence: evidence.rows,
    };
  }

  private async ensureSubmissionExists(submissionId: string) {
    const result = await this.database.query<SubmissionAccessRow>(
      `SELECT id AS "submissionId", student_id AS "studentId", status,
              created_at AS "createdAt"
         FROM submissions
        WHERE id = $1`,
      [submissionId],
    );

    const submission = result.rows[0];
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    return submission;
  }

  private async persistEvaluationDraft(input: {
    context: SubmissionEvaluationContext;
    draft: EvaluationDraft;
    promptVersion: string;
    llmResponse: LlmJsonResponse | null;
    ruleCheck: RuleCheckResult;
    skippedReason?: string;
  }) {
    await this.database.withTransaction(async (client) => {
      const evaluation = await upsertEvaluationResult(client, input.context.submission.submissionId, input.draft);
      await client.query('DELETE FROM metric_scores WHERE evaluation_result_id = $1', [evaluation.id]);
      await client.query('DELETE FROM verification_findings WHERE evaluation_result_id = $1', [evaluation.id]);

      const ruleScoreByMetricId = new Map(input.ruleCheck.metricScores.map((score) => [score.metricId, score]));
      const aiScoreByMetricId = new Map(input.draft.metricScores.map((score) => [score.metricId, score]));
      for (const metric of input.context.metrics) {
        const metricScore = aiScoreByMetricId.get(metric.id);
        const ruleScore = ruleScoreByMetricId.get(metric.id);
        await client.query(
          `INSERT INTO metric_scores (evaluation_result_id, rubric_metric_id, rule_score, ai_score, confidence, comments)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            evaluation.id,
            metric.id,
            ruleScore?.ruleScore ?? null,
            metricScore?.aiScore ?? null,
            metricScore?.confidence ?? null,
            serializeMetricComments(ruleScore?.comments, metricScore?.comments),
          ],
        );
      }

      for (const finding of [...input.ruleCheck.findings, ...input.draft.findings]) {
        await client.query(
          `INSERT INTO verification_findings (evaluation_result_id, finding_type, severity, evidence, suggestion, source_ref)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [evaluation.id, finding.type, finding.severity, finding.evidence, finding.suggestion, finding.sourceRef ?? null],
        );
      }

      if (input.llmResponse) {
        await insertLlmCallLog(client, {
          submissionId: input.context.submission.submissionId,
          provider: input.llmResponse.provider,
          modelName: input.llmResponse.modelName,
          promptVersion: input.promptVersion,
          inputHash: input.llmResponse.inputHash,
          outputJson: input.llmResponse.parsedJson,
          status: 'succeeded',
          latencyMs: input.llmResponse.latencyMs,
        });
      }

      await client.query(
        `UPDATE submissions
            SET status = 'teacher_review', current_error = NULL, updated_at = now()
          WHERE id = $1`,
        [input.context.submission.submissionId],
      );

      await this.auditService.record({
        action: input.skippedReason ? 'submission.evaluation_skipped' : 'submission.evaluation_succeeded',
        entityType: 'submission',
        entityId: input.context.submission.submissionId,
        detail: {
          promptVersion: input.promptVersion,
          provider: input.llmResponse?.provider ?? null,
          modelName: input.llmResponse?.modelName ?? null,
          metricScoreCount: input.context.metrics.length,
          findingCount: input.draft.findings.length + input.ruleCheck.findings.length,
          ruleFindingCount: input.ruleCheck.findings.length,
          skippedReason: input.skippedReason ?? null,
        },
        client,
      });
    });
  }

  private async recordLlmFailure(
    submissionId: string,
    promptVersion: string,
    inputHash: string,
    error: unknown,
    response?: LlmJsonResponse,
  ) {
    const config = this.llmGateway.getConfig();
    await this.database.query(
      `INSERT INTO llm_call_logs (submission_id, provider, model_name, prompt_version, input_hash, output_json, status, latency_ms, error_message)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'failed', $7, $8)`,
      [
        submissionId,
        config.provider,
        (response?.modelName ?? config.modelName) || 'unconfigured',
        promptVersion,
        inputHash,
        response ? JSON.stringify(response.parsedJson) : null,
        response?.latencyMs ?? null,
        getErrorMessage(error),
      ],
    );
  }
}

async function upsertEvaluationResult(client: PoolClient, submissionId: string, draft: EvaluationDraft) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO evaluation_results (submission_id, status, total_ai_score)
     VALUES ($1, 'ai_draft', $2)
     ON CONFLICT (submission_id)
     DO UPDATE SET status = 'ai_draft', total_ai_score = $2, updated_at = now()
     RETURNING id`,
    [submissionId, draft.totalAiScore],
  );
  return result.rows[0];
}

async function insertLlmCallLog(
  client: PoolClient,
  input: {
    submissionId: string;
    provider: string;
    modelName: string;
    promptVersion: string;
    inputHash: string;
    outputJson: unknown;
    status: 'succeeded';
    latencyMs: number;
  },
) {
  await client.query(
    `INSERT INTO llm_call_logs (submission_id, provider, model_name, prompt_version, input_hash, output_json, status, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [
      input.submissionId,
      input.provider,
      input.modelName,
      input.promptVersion,
      input.inputHash,
      JSON.stringify(input.outputJson),
      input.status,
      input.latencyMs,
    ],
  );
}

async function loadEvaluationForMutation(client: PoolClient, submissionId: string) {
  const result = await client.query<EvaluationForMutationRow>(
    `SELECT er.id, er.submission_id AS "submissionId", s.student_id AS "studentId",
            er.status, er.final_score AS "finalScore"
       FROM evaluation_results er
       JOIN submissions s ON s.id = er.submission_id
      WHERE er.submission_id = $1
      FOR UPDATE OF er, s`,
    [submissionId],
  );
  const evaluation = result.rows[0];
  if (!evaluation) {
    throw new NotFoundException('Evaluation result not found');
  }
  return evaluation;
}

async function loadMetricScoresForReview(client: PoolClient, evaluationResultId: string) {
  const result = await client.query<MetricScoreForReviewRow>(
    `SELECT ms.id, ms.rubric_metric_id AS "rubricMetricId", rm.name AS "metricName",
            rm.weight, rm.max_score AS "maxScore", ms.rule_score AS "ruleScore",
            ms.ai_score AS "aiScore", ms.teacher_score AS "teacherScore",
            ms.final_score AS "finalScore", ms.comments
       FROM metric_scores ms
       JOIN rubric_metrics rm ON rm.id = ms.rubric_metric_id
      WHERE ms.evaluation_result_id = $1
      ORDER BY rm.sort_order ASC, rm.created_at ASC
      FOR UPDATE OF ms`,
    [evaluationResultId],
  );
  return result.rows;
}

function validateTeacherMetricScores(input: ReviewSubmissionDto['metricScores'], metrics: MetricScoreForReviewRow[]) {
  const metricMap = new Map(metrics.map((metric) => [metric.rubricMetricId, metric]));
  const seen = new Set<string>();
  for (const metricScore of input ?? []) {
    if (seen.has(metricScore.rubricMetricId)) {
      throw new BadRequestException(`Duplicate metric score override: ${metricScore.rubricMetricId}`);
    }
    seen.add(metricScore.rubricMetricId);

    const metric = metricMap.get(metricScore.rubricMetricId);
    if (!metric) {
      throw new BadRequestException(`Unknown rubric metric: ${metricScore.rubricMetricId}`);
    }
    const maxScore = Number(metric.maxScore);
    if (!Number.isFinite(metricScore.teacherScore) || metricScore.teacherScore < 0 || metricScore.teacherScore > maxScore) {
      throw new BadRequestException(`Teacher score for ${metric.metricName} must be between 0 and ${maxScore}`);
    }
  }
}

function findMetricScore(metrics: MetricScoreForReviewRow[], rubricMetricId: string) {
  const metric = metrics.find((item) => item.rubricMetricId === rubricMetricId);
  if (!metric) {
    throw new BadRequestException(`Unknown rubric metric: ${rubricMetricId}`);
  }
  return metric;
}

function calculateWeightedFinalScore(metrics: MetricScoreForReviewRow[]) {
  let total = 0;
  for (const metric of metrics) {
    const finalScore = metric.finalScore === null ? null : Number(metric.finalScore);
    const maxScore = Number(metric.maxScore);
    const weight = Number(metric.weight);
    if (finalScore === null || !Number.isFinite(finalScore)) {
      throw new BadRequestException(`Metric ${metric.metricName} is missing a final score`);
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0 || !Number.isFinite(weight) || weight <= 0) {
      throw new BadRequestException(`Metric ${metric.metricName} has invalid scoring metadata`);
    }
    total += (finalScore / maxScore) * weight;
  }
  return Number(total.toFixed(2));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }
  return String(error).slice(0, 2000);
}

function serializeMetricComments(ruleComments: string[] | undefined, aiComments: string[] | undefined) {
  // metric_scores.comments is a NOT NULL JSONB array; persist [] instead of null for a stable API shape.
  return JSON.stringify([...(ruleComments ?? []), ...(aiComments ?? [])]);
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}
