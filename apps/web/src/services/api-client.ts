import type {
  AuditLog,
  AuthenticatedUser,
  AuthSession,
  Evaluation,
  Job,
  ReportExport,
  ReportStatistics,
  ReviewMetricScoreInput,
  Submission,
  UploadedArtifact,
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

  async listSubmissions(limit = 20) {
    const submissions = await this.request<Submission[]>('/submissions');
    return submissions.slice(0, limit);
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

  async listJobs(limit = 12) {
    return this.request<Job[]>(`/jobs?${new URLSearchParams({ limit: String(limit) })}`);
  }

  async listAuditLogs(limit = 10) {
    return this.request<AuditLog[]>(`/audit-logs?${new URLSearchParams({ limit: String(limit) })}`);
  }

  async getEvaluation(submissionId: string) {
    return this.request<Evaluation>(`/evaluations/submissions/${encodeURIComponent(submissionId)}`);
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

  async getReportStatistics() {
    return this.request<ReportStatistics>('/reports/statistics');
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
    const [me, submissions, jobs, auditLogs, statistics, exports] = await Promise.all([
      this.me(),
      this.listSubmissions(),
      this.listJobs(),
      this.listAuditLogs(),
      this.getReportStatistics(),
      this.listReportExports(),
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
