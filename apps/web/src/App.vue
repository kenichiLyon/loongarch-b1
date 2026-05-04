<template>
  <main class="shell">
    <section class="hero">
      <div class="hero__content">
        <p class="eyebrow">LoongArch · Kylin · LLM Assisted Assessment</p>
        <h1>软件实训成果智能核查评价与报表系统</h1>
        <p class="summary">
          面向学生提交、教师复核和课程统计的 PC Web 工作台，打通上传解析、规则核查、AI 初评、教师确认与报表导出闭环。
        </p>
      </div>
      <form class="login-panel" @submit.prevent="handleLogin">
        <div>
          <span class="panel-kicker">API 工作台</span>
          <h2>连接后端服务</h2>
          <p>{{ apiBaseUrl }}</p>
        </div>
        <label>
          用户名
          <input v-model="loginForm.username" autocomplete="username" placeholder="admin / teacher / student" />
        </label>
        <label>
          密码
          <input v-model="loginForm.password" autocomplete="current-password" placeholder="至少 8 位" type="password" />
        </label>
        <div class="actions">
          <button :disabled="isBusy" type="submit">{{ isBusy ? '连接中...' : '登录并刷新' }}</button>
          <button class="ghost-button" type="button" @click="refreshDashboard">刷新状态</button>
        </div>
        <p v-if="sessionUser" class="session-line">当前用户：{{ sessionUser.displayName }} · {{ roleLabel(sessionUser.role) }}</p>
        <p v-else class="session-line">可先用 README 的 bootstrap-admin 初始化管理员。</p>
      </form>
    </section>

    <section class="status-strip" aria-label="系统状态">
      <article v-for="item in statusCards" :key="item.label" class="status-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.hint }}</small>
      </article>
    </section>

    <section v-if="viewError" class="notice notice--error" role="alert">
      <strong>接口暂不可用：</strong>{{ viewError }}
      <span>页面保留空态，便于 amd64 开发机和 LoongArch 目标机分别联调。</span>
    </section>
    <section v-if="viewMessage" class="notice notice--success" role="status">
      <strong>操作完成：</strong>{{ viewMessage }}
    </section>

    <section class="workspace-grid" aria-label="工作台">
      <article class="work-card work-card--wide">
        <header class="card-header">
          <div>
            <span class="panel-kicker">Teacher Review</span>
            <h2>教师复核队列</h2>
          </div>
          <span class="badge">{{ submissions.length }} 份提交</span>
        </header>

        <div v-if="submissions.length === 0" class="empty-state">
          暂无提交记录。创建课程、实训任务和提交物后，这里会显示复核入口。
        </div>
        <div v-else class="submission-layout">
          <ul class="submission-list">
            <li v-for="submission in submissions" :key="submission.id">
              <button
                :class="{ 'is-active': submission.id === selectedSubmissionId }"
                type="button"
                @click="selectSubmission(submission.id)"
              >
                <span>提交 #{{ shortId(submission.id) }}</span>
                <strong>{{ statusLabel(submission.status) }}</strong>
                <small>第 {{ submission.attemptNo }} 次 · {{ formatDate(submission.updatedAt) }}</small>
              </button>
            </li>
          </ul>

          <div class="evaluation-panel">
            <template v-if="evaluation">
              <div class="score-board">
                <span>最终分</span>
                <strong>{{ scoreText(evaluation.finalScore) }}</strong>
                <small>{{ evaluation.status }}</small>
              </div>
              <div class="metric-grid">
                <article v-for="metric in evaluation.metricScores" :key="metric.rubricMetricId">
                  <span>{{ metric.metricName ?? shortId(metric.rubricMetricId) }}</span>
                  <strong>{{ scoreText(metric.finalScore ?? metric.teacherScore ?? metric.aiScore ?? metric.ruleScore) }}</strong>
                  <small>规则 {{ scoreText(metric.ruleScore) }} · AI {{ scoreText(metric.aiScore) }}</small>
                  <label class="metric-input">
                    教师分
                    <input
                      v-model="metricReviewDraft[metric.rubricMetricId].teacherScore"
                      inputmode="decimal"
                      placeholder="0-100"
                      type="number"
                    />
                  </label>
                  <label class="metric-input">
                    指标评语
                    <input v-model="metricReviewDraft[metric.rubricMetricId].comment" placeholder="可选，说明调整依据" />
                  </label>
                </article>
              </div>
              <div class="review-box">
                <textarea v-model="teacherComment" placeholder="填写教师总评，保存后可发布结果。" />
                <div class="actions">
                  <button :disabled="isBusy || !selectedSubmissionId" type="button" @click="saveReview">保存复核意见</button>
                  <button class="ghost-button" :disabled="isBusy || !selectedSubmissionId" type="button" @click="publishReview">
                    发布给学生
                  </button>
                </div>
              </div>
            </template>
            <div v-else class="empty-state">选择一份提交后查看 AI/规则初评和教师复核入口。</div>
          </div>
        </div>
      </article>

      <article class="work-card">
        <header class="card-header">
          <div>
            <span class="panel-kicker">Student Upload</span>
            <h2>学生成果上传</h2>
          </div>
          <span class="badge">Word / PDF / 截图</span>
        </header>
        <form class="upload-form" @submit.prevent="submitArtifactUpload">
          <label>
            实训任务 ID
            <input v-model="uploadForm.experimentId" placeholder="experimentId，首次提交必填" />
          </label>
          <label v-if="sessionUser?.role !== 'student'">
            学生 ID
            <input v-model="uploadForm.studentId" placeholder="教师/管理员代建提交时填写" />
          </label>
          <label>
            已有提交 ID
            <input v-model="uploadForm.submissionId" placeholder="已有草稿可直接上传，不填则自动创建" />
          </label>
          <label>
            成果类型
            <select v-model="uploadForm.kind">
              <option v-for="option in artifactKindOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label>
            选择文件
            <input type="file" @change="handleUploadFileChange" />
          </label>
          <div class="actions">
            <button :disabled="isBusy || !uploadForm.file" type="submit">上传并排队解析</button>
            <button class="ghost-button" type="button" @click="resetUploadForm">清空</button>
          </div>
          <p class="helper-text">
            上传成功后会写入 ObjectStore、创建 `parse_artifact` 任务，并在任务池与审计日志中可追踪。
          </p>
        </form>
      </article>

      <article class="work-card">
        <header class="card-header">
          <div>
            <span class="panel-kicker">Student Feedback</span>
            <h2>学生已发布反馈</h2>
          </div>
          <span class="badge">只读</span>
        </header>
        <div v-if="publishedFeedback" class="feedback-panel">
          <div class="score-board score-board--compact">
            <span>已发布成绩</span>
            <strong>{{ scoreText(publishedFeedback.finalScore) }}</strong>
            <small>{{ publishedFeedback.status }}</small>
          </div>
          <p v-if="publishedFeedback.teacherComment">{{ publishedFeedback.teacherComment }}</p>
          <ul class="mini-list">
            <li v-for="metric in publishedFeedback.metricScores" :key="metric.rubricMetricId">
              <span>{{ metric.metricName ?? shortId(metric.rubricMetricId) }}</span>
              <strong>{{ scoreText(metric.finalScore) }}</strong>
            </li>
          </ul>
        </div>
        <div v-else class="empty-state">
          学生登录后选择已发布提交，可在这里查看教师发布的成绩、总评和逐项得分；未发布结果不会显示。
        </div>
        <button
          class="ghost-button full-button"
          :disabled="isBusy || !selectedSubmissionId"
          type="button"
          @click="loadPublishedFeedback"
        >
          查看选中提交反馈
        </button>
      </article>

      <article class="work-card">
        <header class="card-header">
          <div>
            <span class="panel-kicker">Async Jobs</span>
            <h2>高并发任务池</h2>
          </div>
          <span class="badge">{{ runningJobCount }} 运行中</span>
        </header>
        <ul v-if="jobs.length > 0" class="timeline-list">
          <li v-for="job in jobs" :key="job.id">
            <span :class="['dot', `dot--${job.status}`]"></span>
            <div>
              <strong>{{ jobTypeLabel(job.jobType) }}</strong>
              <small>{{ statusLabel(job.status) }} · {{ job.attempts }}/{{ job.maxAttempts }} · {{ formatDate(job.updatedAt) }}</small>
              <p v-if="job.errorMessage">{{ job.errorMessage }}</p>
            </div>
          </li>
        </ul>
        <div v-else class="empty-state">暂无异步任务。上传、评价、报表导出都会进入 PostgreSQL 队列。</div>
      </article>

      <article class="work-card">
        <header class="card-header">
          <div>
            <span class="panel-kicker">Reports</span>
            <h2>统计与导出</h2>
          </div>
          <span class="badge">Excel / PDF</span>
        </header>
        <div class="report-chart" aria-label="平均分概览">
          <div class="ring" :style="{ '--score': averageScorePercent }">
            <span>{{ scoreText(statistics?.summary.averageScore) }}</span>
          </div>
          <div>
            <strong>{{ statistics?.summary.publishedCount ?? 0 }} 份已发布</strong>
            <small>最低 {{ scoreText(statistics?.summary.minScore) }} · 最高 {{ scoreText(statistics?.summary.maxScore) }}</small>
          </div>
        </div>
        <div class="actions">
          <button :disabled="isBusy" type="button" @click="createExport('course', 'xlsx')">生成 Excel</button>
          <button class="ghost-button" :disabled="isBusy" type="button" @click="createExport('course', 'pdf')">生成 PDF</button>
        </div>
        <ul v-if="reportExports.length > 0" class="export-list">
          <li v-for="item in reportExports" :key="item.id">
            <span>{{ item.reportType }} · {{ item.format }}</span>
            <strong>{{ statusLabel(item.status) }}</strong>
            <small>{{ item.storageKey ?? item.errorMessage ?? formatDate(item.createdAt) }}</small>
            <button
              v-if="item.status === 'succeeded'"
              class="inline-button"
              type="button"
              @click="downloadExport(item)"
            >
              下载文件
            </button>
          </li>
        </ul>
        <div v-else class="empty-state">暂无导出记录。导出任务会异步生成并写入对象存储。</div>
      </article>

      <article class="work-card work-card--wide">
        <header class="card-header">
          <div>
            <span class="panel-kicker">Findings & Audit</span>
            <h2>核查发现与审计留痕</h2>
          </div>
          <span class="badge">可追溯</span>
        </header>
        <div class="audit-layout">
          <ul v-if="evaluation?.findings.length" class="finding-list">
            <li v-for="finding in evaluation.findings" :key="`${finding.findingType}-${finding.evidence}`">
              <strong>{{ findingTypeLabel(finding.findingType) }} · {{ severityLabel(finding.severity) }}</strong>
              <p>{{ finding.evidence }}</p>
              <small>{{ finding.suggestion }}</small>
            </li>
          </ul>
          <div v-else class="empty-state">暂无核查发现；规则核查和 LLM 初评完成后会在这里聚合。</div>

          <ul v-if="auditLogs.length > 0" class="timeline-list">
            <li v-for="log in auditLogs" :key="log.id">
              <span class="dot dot--audit"></span>
              <div>
                <strong>{{ log.action }}</strong>
                <small>{{ log.actorDisplayName ?? '系统' }} · {{ log.entityType }} · {{ formatDate(log.createdAt) }}</small>
              </div>
            </li>
          </ul>
          <div v-else class="empty-state">暂无审计日志。上传、解析、复核、发布和导出都会留痕。</div>
        </div>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ApiClient, ApiClientError, getDefaultApiBaseUrl } from './services/api-client';
import type { ArtifactKind, AuditLog, Evaluation, Job, MetricScore, ReportExport, ReportStatistics, Submission, UserRole } from './types/api';

const apiClient = new ApiClient();
const apiBaseUrl = getDefaultApiBaseUrl();

const loginForm = reactive({
  username: '',
  password: '',
});
const isBusy = ref(false);
const viewError = ref('');
const viewMessage = ref('');
const sessionUser = ref<{ displayName: string; role: UserRole } | null>(null);
const submissions = ref<Submission[]>([]);
const jobs = ref<Job[]>([]);
const auditLogs = ref<AuditLog[]>([]);
const statistics = ref<ReportStatistics | null>(null);
const reportExports = ref<ReportExport[]>([]);
const evaluation = ref<Evaluation | null>(null);
const selectedSubmissionId = ref('');
const teacherComment = ref('');
const metricReviewDraft = reactive<Record<string, { teacherScore: string; comment: string }>>({});
const publishedFeedback = ref<Evaluation | null>(null);
const uploadForm = reactive<{
  experimentId: string;
  studentId: string;
  submissionId: string;
  kind: ArtifactKind;
  file: File | null;
}>({
  experimentId: '',
  studentId: '',
  submissionId: '',
  kind: 'pdf',
  file: null,
});

const artifactKindOptions: Array<{ value: ArtifactKind; label: string }> = [
  { value: 'pdf', label: 'PDF 报告' },
  { value: 'word', label: 'Word 文档' },
  { value: 'image', label: '界面截图' },
  { value: 'code_archive', label: '代码压缩包' },
  { value: 'other', label: '其他文本材料' },
];

const runningJobCount = computed(() => jobs.value.filter((job) => job.status === 'running').length);
const averageScorePercent = computed(() => {
  const score = Number(statistics.value?.summary.averageScore ?? 0);
  return `${Math.max(0, Math.min(100, score))}%`;
});
const statusCards = computed(() => [
  {
    label: '已发布评价',
    value: statistics.value?.summary.publishedCount ?? 0,
    hint: '进入报表统计的评价结果',
  },
  {
    label: '平均分',
    value: scoreText(statistics.value?.summary.averageScore),
    hint: '课程 / 班级可按筛选扩展',
  },
  {
    label: '任务积压',
    value: jobs.value.filter((job) => job.status === 'queued').length,
    hint: '解析、评价、导出异步排队',
  },
  {
    label: '复核队列',
    value: submissions.value.filter((submission) => submission.status === 'teacher_review').length,
    hint: '教师确认后才能发布',
  },
]);

onMounted(() => {
  void refreshDashboard();
});

async function handleLogin() {
  await withBusy(async () => {
    viewError.value = '';
    viewMessage.value = '';
    const session = await apiClient.login(loginForm.username, loginForm.password);
    sessionUser.value = session.user;
    await refreshDashboard();
  });
}

async function refreshDashboard() {
  await withBusy(async () => {
    viewError.value = '';
    viewMessage.value = '';
    const snapshot = await apiClient.loadDashboardSnapshot(selectedSubmissionId.value);
    sessionUser.value = snapshot.me ? { displayName: snapshot.me.displayName, role: snapshot.me.role } : null;
    submissions.value = snapshot.submissions;
    jobs.value = snapshot.jobs;
    auditLogs.value = snapshot.auditLogs;
    statistics.value = snapshot.statistics;
    reportExports.value = snapshot.exports;
    evaluation.value = snapshot.evaluation;
    selectedSubmissionId.value = snapshot.evaluation?.submissionId ?? snapshot.submissions[0]?.id ?? '';
    teacherComment.value = snapshot.evaluation?.teacherComment ?? '';
    resetMetricReviewDraft(snapshot.evaluation?.metricScores ?? []);
    publishedFeedback.value = null;
  });
}

async function selectSubmission(submissionId: string) {
  await withBusy(async () => {
    selectedSubmissionId.value = submissionId;
    evaluation.value = await apiClient.getEvaluation(submissionId);
    teacherComment.value = evaluation.value.teacherComment ?? '';
    resetMetricReviewDraft(evaluation.value.metricScores);
    publishedFeedback.value = null;
  });
}

async function saveReview() {
  if (!selectedSubmissionId.value) {
    return;
  }
  await withBusy(async () => {
    evaluation.value = await apiClient.reviewSubmission(selectedSubmissionId.value, {
      teacherComment: teacherComment.value,
      metricScores: buildMetricReviewPayload(),
    });
    resetMetricReviewDraft(evaluation.value.metricScores);
    viewMessage.value = '复核意见已保存。';
  });
}

async function publishReview() {
  if (!selectedSubmissionId.value) {
    return;
  }
  await withBusy(async () => {
    evaluation.value = await apiClient.publishSubmission(selectedSubmissionId.value);
    await refreshDashboard();
    viewMessage.value = '评价结果已发布给学生。';
  });
}

async function createExport(reportType: 'student' | 'class' | 'course', format: 'xlsx' | 'pdf') {
  await withBusy(async () => {
    await apiClient.createReportExport(reportType, format);
    reportExports.value = await apiClient.listReportExports();
    jobs.value = await apiClient.listJobs();
    viewMessage.value = '报表导出任务已创建。';
  });
}

async function submitArtifactUpload() {
  if (!uploadForm.file) {
    viewError.value = '请选择需要上传的成果文件。';
    return;
  }
  await withBusy(async () => {
    let submissionId = uploadForm.submissionId.trim();
    if (!submissionId) {
      if (!uploadForm.experimentId.trim()) {
        throw new Error('首次上传需要填写实训任务 ID。');
      }
      const submission = await apiClient.createSubmission({
        experimentId: uploadForm.experimentId.trim(),
        studentId: sessionUser.value?.role === 'student' ? undefined : uploadForm.studentId.trim() || undefined,
      });
      submissionId = submission.id;
      uploadForm.submissionId = submission.id;
      selectedSubmissionId.value = submission.id;
    }

    const artifact = await apiClient.uploadArtifact(submissionId, uploadForm.kind, uploadForm.file as File);
    viewMessage.value = `成果 ${artifact.originalName} 已上传，解析任务已入队。`;
    uploadForm.file = null;
    submissions.value = await apiClient.listSubmissions();
    jobs.value = await apiClient.listJobs();
    auditLogs.value = await apiClient.listAuditLogs();
  });
}

async function loadPublishedFeedback() {
  if (!selectedSubmissionId.value) {
    return;
  }
  await withBusy(async () => {
    publishedFeedback.value = await apiClient.getPublishedEvaluation(selectedSubmissionId.value);
    viewMessage.value = '已读取发布反馈。';
  });
}

async function downloadExport(item: ReportExport) {
  if (typeof window === 'undefined') {
    return;
  }
  const token = apiClient.getAuthorizationHeader();
  if (!token) {
    viewError.value = '请先登录后再下载报表。';
    return;
  }

  const url = apiClient.buildReportExportDownloadUrl(item.id);
  const response = await fetch(url, {
    headers: {
      Authorization: token,
    },
  });
  if (!response.ok) {
    viewError.value = `${response.status} ${response.statusText}`;
    return;
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${item.reportType}-report-${shortId(item.id)}.${item.format}`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function resetMetricReviewDraft(metricScores: MetricScore[]) {
  for (const key of Object.keys(metricReviewDraft)) {
    delete metricReviewDraft[key];
  }
  for (const metric of metricScores) {
    const score = metric.teacherScore ?? metric.finalScore ?? metric.aiScore ?? metric.ruleScore ?? '';
    metricReviewDraft[metric.rubricMetricId] = {
      teacherScore: score === null ? '' : String(score),
      comment: '',
    };
  }
}

function buildMetricReviewPayload() {
  return Object.entries(metricReviewDraft)
    .map(([rubricMetricId, draft]) => ({
      rubricMetricId,
      teacherScore: Number(draft.teacherScore),
      comment: draft.comment.trim() || undefined,
    }))
    .filter((item) => Number.isFinite(item.teacherScore));
}

function handleUploadFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  uploadForm.file = input.files?.[0] ?? null;
}

function resetUploadForm() {
  uploadForm.experimentId = '';
  uploadForm.studentId = '';
  uploadForm.submissionId = '';
  uploadForm.kind = 'pdf';
  uploadForm.file = null;
}

async function withBusy(action: () => Promise<void>) {
  isBusy.value = true;
  try {
    await action();
  } catch (error) {
    viewError.value = formatError(error);
    viewMessage.value = '';
  } finally {
    isBusy.value = false;
  }
}

function formatError(error: unknown) {
  if (error instanceof ApiClientError) {
    return `${error.status} ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function roleLabel(role: UserRole) {
  return {
    admin: '管理员',
    teacher: '教师',
    student: '学生',
  }[role];
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: '草稿',
    parsing: '解析中',
    evaluating: '评价中',
    teacher_review: '待复核',
    published: '已发布',
    queued: '排队中',
    running: '运行中',
    succeeded: '成功',
    failed: '失败',
    cancelled: '已取消',
  };
  return map[status] ?? status;
}

function jobTypeLabel(jobType: string) {
  const map: Record<string, string> = {
    parse_artifact: '成果解析',
    evaluate_submission: '智能评价',
    export_report: '报表导出',
  };
  return map[jobType] ?? jobType;
}

function severityLabel(severity: string) {
  const map: Record<string, string> = {
    info: '提示',
    warning: '警告',
    critical: '严重',
  };
  return map[severity] ?? severity;
}

function findingTypeLabel(type: string) {
  const map: Record<string, string> = {
    requirement: '要求覆盖',
    step: '步骤完整性',
    logic: '逻辑风险',
    security: '安全风险',
    document: '文档规范',
    code: '代码质量',
  };
  return map[type] ?? type;
}

function scoreText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : String(value);
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
</script>
