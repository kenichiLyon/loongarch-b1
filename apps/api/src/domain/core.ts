export type EntityId = string;

export enum UserRole {
  Admin = 'admin',
  Teacher = 'teacher',
  Student = 'student',
}

export enum SubmissionStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Parsing = 'parsing',
  Evaluating = 'evaluating',
  TeacherReview = 'teacher_review',
  Published = 'published',
  Failed = 'failed',
}

export enum ArtifactKind {
  Word = 'word',
  Pdf = 'pdf',
  Image = 'image',
  CodeArchive = 'code_archive',
  GitLink = 'git_link',
  Other = 'other',
}

export interface RubricMetric {
  id: EntityId;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
  allowTeacherOverride: boolean;
}

export interface RubricValidationResult {
  valid: boolean;
  totalWeight: number;
  errors: string[];
}

export interface VerificationFinding {
  type: 'requirement' | 'step' | 'logic' | 'security' | 'document' | 'code';
  severity: 'info' | 'warning' | 'critical';
  evidence: string;
  suggestion: string;
  sourceRef?: string;
}

export interface MetricScore {
  metricId: EntityId;
  ruleScore?: number;
  aiScore?: number;
  teacherScore?: number;
  finalScore?: number;
  confidence?: number;
  comments: string[];
}

export interface EvaluationResult {
  submissionId: EntityId;
  status: 'ai_draft' | 'teacher_reviewed' | 'published';
  metricScores: MetricScore[];
  findings: VerificationFinding[];
  model?: {
    provider: 'cloud' | 'local';
    name: string;
    promptVersion: string;
    inputHash: string;
  };
}

export function validateRubricMetrics(metrics: RubricMetric[]): RubricValidationResult {
  const errors: string[] = [];

  if (metrics.length === 0) {
    errors.push('评价指标不能为空');
  }

  const totalWeight = Number(metrics.reduce((sum, metric) => sum + metric.weight, 0).toFixed(4));
  const names = new Set<string>();

  for (const metric of metrics) {
    const normalizedName = metric.name.trim();
    if (!normalizedName) {
      errors.push(`指标 ${metric.id} 名称不能为空`);
    }
    if (names.has(normalizedName)) {
      errors.push(`指标名称重复：${normalizedName}`);
    }
    names.add(normalizedName);

    if (metric.weight <= 0) {
      errors.push(`指标 ${metric.name} 权重必须大于 0`);
    }
    if (metric.maxScore <= 0) {
      errors.push(`指标 ${metric.name} 最高分必须大于 0`);
    }
  }

  if (Math.abs(totalWeight - 100) > 0.0001) {
    errors.push(`评价指标权重总和必须为 100，当前为 ${totalWeight}`);
  }

  return {
    valid: errors.length === 0,
    totalWeight,
    errors,
  };
}
