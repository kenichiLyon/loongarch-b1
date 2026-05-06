export type UserRole = 'admin' | 'teacher' | 'student';

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface UserSummary {
  id: string;
  role: UserRole;
  username: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  studentNo?: string | null;
  teacherNo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: AuthenticatedUser;
  accessToken: string;
  expiresAt: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description: string | null;
  ownerTeacherId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  grade: string | null;
  major: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Experiment {
  id: string;
  courseId: string;
  rubricTemplateId: string;
  title: string;
  requirementText: string;
  dueAt: string | null;
  allowedArtifactKinds: ArtifactKind[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RubricMetricDefinition {
  id?: string;
  name: string;
  description: string;
  weight: string | number;
  maxScore: string | number;
  scoringRule?: string;
  allowTeacherOverride?: boolean;
  sortOrder?: number;
}

export interface RubricTemplate {
  id: string;
  courseId: string;
  name: string;
  version: number;
  description: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  metrics: RubricMetricDefinition[];
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  classId: string;
  studentUsername: string;
  studentDisplayName: string;
  courseName: string;
  className: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  experimentId: string;
  studentId: string;
  status: string;
  attemptNo: number;
  submittedAt: string | null;
  currentError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ArtifactKind = 'word' | 'pdf' | 'image' | 'code_archive' | 'git_link' | 'other';

export interface UploadedArtifact {
  id: string;
  submissionId: string;
  kind: ArtifactKind | string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: string | number;
  sha256: string;
  storageKey: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  jobType: 'parse_artifact' | 'evaluate_submission' | 'export_report' | string;
  payload: Record<string, unknown>;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lockedAt: string | null;
  lockedBy: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  detailJson: Record<string, unknown>;
  createdAt: string;
}

export interface MetricScore {
  id?: string;
  rubricMetricId: string;
  metricName?: string;
  ruleScore: string | number | null;
  aiScore: string | number | null;
  teacherScore: string | number | null;
  finalScore: string | number | null;
  confidence?: string | number | null;
  comments?: unknown;
}

export interface ReviewMetricScoreInput {
  rubricMetricId: string;
  teacherScore: number;
  comment?: string;
}

export interface VerificationFinding {
  id?: string;
  findingType: string;
  severity: 'info' | 'warning' | 'critical' | string;
  evidence: string;
  suggestion: string;
  sourceRef: string | null;
  createdAt?: string;
}

export interface Evaluation {
  id?: string;
  submissionId: string;
  status: string;
  totalAiScore?: string | number | null;
  totalTeacherScore?: string | number | null;
  finalScore?: string | number | null;
  teacherComment?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metricScores: MetricScore[];
  findings: VerificationFinding[];
}

export interface ReportStatistics {
  generatedAt: string;
  filters: Record<string, string>;
  summary: {
    publishedCount: number;
    averageScore: number | null;
    minScore: number | null;
    maxScore: number | null;
  };
  metrics: Array<{
    rubricMetricId: string;
    metricName: string;
    averageFinalScore: number | null;
    averageTeacherScore: number | null;
    averageAiScore: number | null;
    averageRuleScore: number | null;
  }>;
  findings: Array<{
    findingType: string;
    severity: string;
    count: number;
  }>;
}

export interface ReportExport {
  id: string;
  reportType: 'student' | 'class' | 'course' | string;
  format: 'xlsx' | 'pdf' | string;
  requestedBy: string | null;
  filterJson: Record<string, string>;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  storageKey: string | null;
  fileSha256: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}
