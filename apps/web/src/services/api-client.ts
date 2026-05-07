import type {
  AuditLog,
  AuthenticatedUser,
  AuthSession,
  ClassGroup,
  Course,
  Enrollment,
  Evaluation,
  EvaluationContextSnapshot,
  Experiment,
  Job,
  ReportExport,
  ReportStatistics,
  ReviewMetricScoreInput,
  RubricTemplate,
  Submission,
  UploadedArtifact,
  UserSummary,
} from '../types/api';

const tokenStorageKey = 'loongarch-b1.access-token';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface DashboardSnapshot {
  me: AuthenticatedUser | null;
  submissions: Submission[];
  jobs: Job[];
  auditLogs: AuditLog[];
  statistics: ReportStatistics | null;
  exports: ReportExport[];
  evaluation: Evaluation | null;
  courses: Course[];
  classes: ClassGroup[];
  experiments: Experiment[];
  rubrics: RubricTemplate[];
  users: UserSummary[];
  enrollments: Enrollment[];
}

export function getDefaultApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:3000';
}

export function loadStoredToken() {
  return window.localStorage.getItem(tokenStorageKey) ?? '';
}

export function storeToken(token: string) {
  if (token.trim()) {
    window.localStorage.setItem(tokenStorageKey, token.trim());
  } else {
    window.localStorage.removeItem(tokenStorageKey);
  }
}

export class ApiClient {
  constructor(
    private readonly baseUrl = getDefaultApiBaseUrl(),
    private accessToken = loadStoredToken(),
  ) {}

  setAccessToken(token: string) {
    this.accessToken = token.trim();
    storeToken(this.accessToken);
  }

  clearAccessToken() {
    this.accessToken = '';
    storeToken('');
  }

  async login(username: string, password: string): Promise<AuthSession> {
    const session = await this.request<AuthSession>('/auth/login', {
      method: 'POST',
      body: { username, password },
      authenticated: false,
    });
    this.setAccessToken(session.accessToken);
    return session;
  }

  async me() {
    const response = await this.request<{ user: AuthenticatedUser }>('/auth/me');
    return response.user;
  }

  async listSubmissions(filters: {
    experimentId?: string;
    studentId?: string;
    courseId?: string;
    classId?: string;
    status?: string;
    limit?: number;
  } = {}) {
    const limit = filters.limit ?? 20;
    const query = buildQueryString({
      experimentId: filters.experimentId,
      studentId: filters.studentId,
      courseId: filters.courseId,
      classId: filters.classId,
      status: filters.status,
    });
    const submissions = await this.request<Submission[]>(`/submissions${query}`);
    return submissions.slice(0, limit);
  }

  async listCourses() {
    return this.request<Course[]>('/courses');
  }

  async listUsers(role = '') {
    const query = role ? `?${new URLSearchParams({ role })}` : '';
    return this.request<UserSummary[]>(`/users${query}`);
  }

  async listClasses() {
    return this.request<ClassGroup[]>('/classes');
  }

  async listExperiments(courseId = '') {
    const query = courseId ? `?${new URLSearchParams({ courseId })}` : '';
    return this.request<Experiment[]>(`/experiments${query}`);
  }

  async listRubrics(courseId = '') {
    const query = courseId ? `?${new URLSearchParams({ courseId })}` : '';
    return this.request<RubricTemplate[]>(`/rubrics${query}`);
  }

  async listEnrollments(filters: { courseId?: string; classId?: string; studentId?: string } = {}) {
    const query = buildQueryString(filters);
    return this.request<Enrollment[]>(`/enrollments${query}`);
  }

  async createCourse(payload: { name: string; code: string; description?: string }) {
    return this.request<Course>('/courses', {
      method: 'POST',
      body: payload,
    });
  }

  async createClass(payload: { name: string; grade?: string; major?: string }) {
    return this.request<ClassGroup>('/classes', {
      method: 'POST',
      body: payload,
    });
  }

  async attachClassToCourse(courseId: string, classId: string) {
    return this.request<{ courseId: string; classId: string; attached: boolean }>(`/courses/${encodeURIComponent(courseId)}/classes`, {
      method: 'POST',
      body: { classId },
    });
  }

  async createUser(payload: {
    role: 'admin' | 'teacher' | 'student';
    username: string;
    displayName: string;
    initialPassword: string;
    email?: string;
    phone?: string;
    studentNo?: string;
    teacherNo?: string;
    isActive?: boolean;
  }) {
    return this.request<UserSummary>('/users', {
      method: 'POST',
      body: payload,
    });
  }

  async createEnrollment(payload: { studentId: string; courseId: string; classId: string }) {
    return this.request<Enrollment>('/enrollments', {
      method: 'POST',
      body: payload,
    });
  }

  async createRubric(payload: {
    courseId: string;
    name: string;
    description?: string;
    metrics: Array<{
      name: string;
      description: string;
      weight: number;
      maxScore: number;
      scoringRule?: string;
      allowTeacherOverride?: boolean;
      sortOrder?: number;
    }>;
  }) {
    return this.request<RubricTemplate>('/rubrics', {
      method: 'POST',
      body: payload,
    });
  }

  async createExperiment(payload: {
    courseId: string;
    rubricTemplateId: string;
    title: string;
    requirementText: string;
    dueAt?: string;
    allowedArtifactKinds?: string[];
  }) {
    return this.request<Experiment>('/experiments', {
      method: 'POST',
      body: payload,
    });
  }

  async createSubmission(payload: { experimentId: string; studentId?: string; attemptNo?: number }) {
    return this.request<Submission>('/submissions', {
      method: 'POST',
      body: payload,
    });
  }

  async uploadArtifact(submissionId: string, kind: string, file: File) {
    const formData = new FormData();
    formData.set('kind', kind);
    formData.set('file', file);
    return this.request<UploadedArtifact>(`/submissions/${encodeURIComponent(submissionId)}/artifacts/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  async createGitLinkArtifact(
    submissionId: string,
    payload: {
      url: string;
      branch?: string;
      commitSha?: string;
    },
  ) {
    return this.request<UploadedArtifact>(`/submissions/${encodeURIComponent(submissionId)}/artifacts/git-link`, {
      method: 'POST',
      body: payload,
    });
  }

  async listJobs(limit = 12) {
    return this.request<Job[]>(`/jobs?${new URLSearchParams({ limit: String(limit) })}`);
  }

  async listAuditLogs(limit = 10) {
    return this.request<AuditLog[]>(`/audit-logs?${new URLSearchParams({ limit: String(limit) })}`);
  }

  async getEvaluation(submissionId: string) {
    return this.request<Evaluation>(`/evaluations/submissions/${encodeURIComponent(submissionId)}`);
  }

  async getLatestEvaluationContext(submissionId: string) {
    return this.request<EvaluationContextSnapshot>(`/evaluations/submissions/${encodeURIComponent(submissionId)}/context-latest`);
  }

  async getEvaluationContextHistory(submissionId: string) {
    return this.request<EvaluationContextSnapshot[]>(`/evaluations/submissions/${encodeURIComponent(submissionId)}/context-history`);
  }

  async getPublishedEvaluation(submissionId: string) {
    return this.request<Evaluation>(`/evaluations/submissions/${encodeURIComponent(submissionId)}/published`);
  }

  async reviewSubmission(submissionId: string, payload: { teacherComment: string; metricScores?: ReviewMetricScoreInput[] }) {
    return this.request<Evaluation>(`/evaluations/submissions/${encodeURIComponent(submissionId)}/review`, {
      method: 'PATCH',
      body: payload,
    });
  }

  async publishSubmission(submissionId: string) {
    return this.request<Evaluation>(`/evaluations/submissions/${encodeURIComponent(submissionId)}/publish`, {
      method: 'POST',
    });
  }

  async getReportStatistics(filters: { courseId?: string; classId?: string; experimentId?: string; studentId?: string } = {}) {
    const query = buildQueryString(filters);
    return this.request<ReportStatistics>(`/reports/statistics${query}`);
  }

  async listReportExports(limit = 8) {
    return this.request<ReportExport[]>(`/reports/exports?${new URLSearchParams({ limit: String(limit) })}`);
  }

  async createReportExport(reportType: 'student' | 'class' | 'course', format: 'xlsx' | 'pdf') {
    return this.request<ReportExport>('/reports/exports', {
      method: 'POST',
      body: {
        reportType,
        format,
        filters: {},
      },
    });
  }

  buildReportExportDownloadUrl(exportId: string) {
    return `${this.baseUrl}/reports/exports/${encodeURIComponent(exportId)}/download`;
  }

  getAuthorizationHeader() {
    return this.accessToken ? `Bearer ${this.accessToken}` : '';
  }

  async loadDashboardSnapshot(selectedSubmissionId = ''): Promise<DashboardSnapshot> {
    const me = await this.me();
    const [submissions, jobs, auditLogs, statistics, exports, courses, classes, experiments, rubrics, users, enrollments] = await Promise.all([
      this.listSubmissions(),
      this.listJobs(),
      this.listAuditLogs(),
      this.getReportStatistics(),
      this.listReportExports(),
      this.listCourses(),
      this.listClasses(),
      this.listExperiments(),
      me.role === 'student' ? Promise.resolve([] as RubricTemplate[]) : this.listRubrics(),
      me.role === 'admin' || me.role === 'teacher' ? this.listUsers() : Promise.resolve([] as UserSummary[]),
      me.role === 'admin' || me.role === 'teacher' ? this.listEnrollments() : Promise.resolve([] as Enrollment[]),
    ]);
    const targetSubmissionId = selectedSubmissionId || submissions[0]?.id || '';
    const evaluation = targetSubmissionId ? await this.loadEvaluationForRole(targetSubmissionId, me.role) : null;

    return {
      me,
      submissions,
      jobs,
      auditLogs,
      statistics,
      exports,
      evaluation,
      courses,
      classes,
      experiments,
      rubrics,
      users,
      enrollments,
    };
  }

  private async loadEvaluationForRole(submissionId: string, role: AuthenticatedUser['role']) {
    try {
      return role === 'student' ? await this.getPublishedEvaluation(submissionId) : await this.getEvaluation(submissionId);
    } catch (error) {
      if (error instanceof ApiClientError && role === 'student' && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      authenticated?: boolean;
    } = {},
  ): Promise<T> {
    const headers = new Headers();
    headers.set('Accept', 'application/json');
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (options.body !== undefined && !isFormData) {
      headers.set('Content-Type', 'application/json');
    }
    if (options.authenticated !== false && this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: buildRequestBody(options.body),
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new ApiClientError(readErrorMessage(payload, response.statusText), response.status, payload);
    }
    return payload as T;
  }
}

function buildRequestBody(body: unknown) {
  if (body === undefined) {
    return undefined;
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return body;
  }
  return JSON.stringify(body);
}

function buildQueryString(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return fallback || 'API request failed';
}
