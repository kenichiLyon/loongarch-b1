import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { UserRole } from '../domain/core';
import { buildLlmInputHash, LlmGatewayService, type LlmJsonResponse } from '../llm/llm-gateway.service';
import { buildEvaluationPrompt } from './evaluation-prompt';
import {
  buildSkippedEvaluationDraft,
  validateEvaluationDraft,
  type EvaluationDraft,
  type EvaluationMetricDefinition,
} from './evaluation-output.schema';

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
  aiScore: string | null;
  teacherScore: string | null;
  finalScore: string | null;
  confidence: string | null;
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
    });
    return { submissionId, status: 'ai_draft', metricScoreCount: draft.metricScores.length, findingCount: draft.findings.length };
  }

  async getEvaluationForUser(submissionId: string, user: AuthenticatedUser): Promise<unknown> {
    const submission = await this.loadSubmissionForAccess(submissionId);
    if (user.role === UserRole.Student && submission.studentId !== user.id) {
      throw new ForbiddenException('Students can only access their own evaluation');
    }

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
              ms.ai_score AS "aiScore", ms.teacher_score AS "teacherScore", ms.final_score AS "finalScore",
              ms.confidence, ms.comments
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

  private async loadSubmissionForAccess(submissionId: string) {
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
    skippedReason?: string;
  }) {
    await this.database.withTransaction(async (client) => {
      const evaluation = await upsertEvaluationResult(client, input.context.submission.submissionId, input.draft);
      await client.query('DELETE FROM metric_scores WHERE evaluation_result_id = $1', [evaluation.id]);
      await client.query('DELETE FROM verification_findings WHERE evaluation_result_id = $1', [evaluation.id]);

      for (const metricScore of input.draft.metricScores) {
        await client.query(
          `INSERT INTO metric_scores (evaluation_result_id, rubric_metric_id, ai_score, confidence, comments)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [
            evaluation.id,
            metricScore.metricId,
            metricScore.aiScore,
            metricScore.confidence,
            JSON.stringify(metricScore.comments),
          ],
        );
      }

      for (const finding of input.draft.findings) {
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
          metricScoreCount: input.draft.metricScores.length,
          findingCount: input.draft.findings.length,
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }
  return String(error).slice(0, 2000);
}
