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

    <section class="filter-dock" aria-label="筛选器">
      <label>
        课程
        <select v-model="selectedCourseId" @change="handleCourseSelection">
          <option value="">全部课程</option>
          <option v-for="course in courses" :key="course.id" :value="course.id">{{ course.name }} · {{ course.code }}</option>
        </select>
      </label>
      <label>
        班级
        <select v-model="selectedClassId" @change="handleClassSelection">
          <option value="">全部班级</option>
          <option v-for="classGroup in classes" :key="classGroup.id" :value="classGroup.id">
            {{ classGroup.name }}{{ classGroup.grade ? ` · ${classGroup.grade}` : '' }}
          </option>
        </select>
      </label>
      <label>
        实训任务
        <select v-model="selectedExperimentId" @change="syncSelectedExperiment">
          <option value="">选择实训任务</option>
          <option v-for="experiment in filteredExperiments" :key="experiment.id" :value="experiment.id">
            {{ experiment.title }}
          </option>
        </select>
      </label>
      <label v-if="sessionUser?.role !== 'student'">
        学生
        <select v-model="selectedStudentId">
          <option value="">全部学生</option>
          <option v-for="student in filteredStudentOptions" :key="student.id" :value="student.id">
            {{ student.displayName }} · {{ student.username }}
          </option>
        </select>
      </label>
      <label>
        提交状态
        <select v-model="selectedSubmissionStatus">
          <option value="">全部状态</option>
          <option v-for="status in submissionStatusOptions" :key="status.value" :value="status.value">{{ status.label }}</option>
        </select>
      </label>
      <button class="ghost-button" type="button" @click="applyReportFilters">应用报表筛选</button>
    </section>

    <section class="workspace-grid" aria-label="工作台">
      <article v-if="canManageFoundation" class="work-card work-card--wide">
        <header class="card-header">
          <div>
            <span class="panel-kicker">Foundation Setup</span>
            <h2>基础数据维护</h2>
          </div>
          <span class="badge">课程 / 班级 / 模板 / 任务</span>
        </header>
        <div class="foundation-layout">
          <form class="compact-form" @submit.prevent="createCourseFromForm">
            <h3>新建课程</h3>
            <label>
              课程名称
              <input v-model="courseForm.name" placeholder="软件工程综合实训" />
            </label>
            <label>
              课程代码
              <input v-model="courseForm.code" placeholder="SE-PRACTICE-2026" />
            </label>
            <label>
              课程说明
              <input v-model="courseForm.description" placeholder="可选" />
            </label>
            <button :disabled="isBusy || !courseForm.name || !courseForm.code" type="submit">创建课程</button>
          </form>

          <form class="compact-form" @submit.prevent="createClassFromForm">
            <h3>新建班级</h3>
            <label>
              班级名称
              <input v-model="classForm.name" placeholder="软件 2301" />
            </label>
            <label>
              年级
              <input v-model="classForm.grade" placeholder="2023" />
            </label>
            <label>
              专业
              <input v-model="classForm.major" placeholder="软件技术" />
            </label>
            <button :disabled="isBusy || !classForm.name" type="submit">创建班级</button>
          </form>

          <form v-if="canManageUsers" class="compact-form" @submit.prevent="createUserFromForm">
            <h3>新建用户</h3>
            <label>
              角色
              <select v-model="userForm.role">
                <option value="student">学生</option>
                <option value="teacher">教师</option>
                <option value="admin">管理员</option>
              </select>
            </label>
            <label>
              用户名
              <input v-model="userForm.username" placeholder="student-2301" />
            </label>
            <label>
              显示名
              <input v-model="userForm.displayName" placeholder="张三" />
            </label>
            <label>
              初始密码
              <input v-model="userForm.initialPassword" placeholder="至少 8 位" type="password" />
            </label>
            <label v-if="userForm.role === 'student'">
              学号
              <input v-model="userForm.studentNo" placeholder="20230001" />
            </label>
            <label v-else-if="userForm.role === 'teacher'">
              工号
              <input v-model="userForm.teacherNo" placeholder="T-1001" />
            </label>
            <button
              :disabled="isBusy || !userForm.username || !userForm.displayName || userForm.initialPassword.length < 8"
              type="submit"
            >
              创建用户
            </button>
          </form>

          <form class="compact-form" @submit.prevent="attachSelectedClass">
            <h3>绑定课程班级</h3>
            <label>
              课程
              <select v-model="foundationSelection.courseId">
                <option value="">选择课程</option>
                <option v-for="course in courses" :key="course.id" :value="course.id">{{ course.name }} · {{ course.code }}</option>
              </select>
            </label>
            <label>
              班级
              <select v-model="foundationSelection.classId">
                <option value="">选择班级</option>
                <option v-for="classGroup in classes" :key="classGroup.id" :value="classGroup.id">{{ classGroup.name }}</option>
              </select>
            </label>
            <button :disabled="isBusy || !foundationSelection.courseId || !foundationSelection.classId" type="submit">绑定</button>
          </form>

          <form class="compact-form" @submit.prevent="createEnrollmentFromForm">
            <h3>学生分班选课</h3>
            <label>
              学生
              <select v-model="enrollmentForm.studentId">
                <option value="">选择学生</option>
                <option v-for="student in studentUsers" :key="student.id" :value="student.id">
                  {{ student.displayName }} · {{ student.username }}
                </option>
              </select>
            </label>
            <label>
              课程
              <select v-model="enrollmentForm.courseId">
                <option value="">选择课程</option>
                <option v-for="course in courses" :key="course.id" :value="course.id">{{ course.name }} · {{ course.code }}</option>
              </select>
            </label>
            <label>
              班级
              <select v-model="enrollmentForm.classId">
                <option value="">选择班级</option>
                <option v-for="classGroup in classes" :key="classGroup.id" :value="classGroup.id">{{ classGroup.name }}</option>
              </select>
            </label>
            <button
              :disabled="isBusy || !enrollmentForm.studentId || !enrollmentForm.courseId || !enrollmentForm.classId"
              type="submit"
            >
              绑定选课
            </button>
          </form>

          <form class="compact-form" @submit.prevent="createRubricFromForm">
            <h3>默认评价模板</h3>
            <label>
              课程
              <select v-model="rubricForm.courseId">
                <option value="">选择课程</option>
                <option v-for="course in courses" :key="course.id" :value="course.id">{{ course.name }} · {{ course.code }}</option>
              </select>
            </label>
            <label>
              模板名称
              <input v-model="rubricForm.name" />
            </label>
            <ul class="mini-list">
              <li v-for="metric in defaultRubricMetrics" :key="metric.name">
                <span>{{ metric.name }}</span>
                <strong>{{ metric.weight }}%</strong>
              </li>
            </ul>
            <button :disabled="isBusy || !rubricForm.courseId || !rubricForm.name" type="submit">创建模板</button>
          </form>

          <form class="compact-form compact-form--wide" @submit.prevent="createExperimentFromForm">
            <h3>新建实训任务</h3>
            <div class="form-row">
              <label>
                课程
                <select v-model="experimentForm.courseId" @change="syncExperimentRubric">
                  <option value="">选择课程</option>
                  <option v-for="course in courses" :key="course.id" :value="course.id">{{ course.name }} · {{ course.code }}</option>
                </select>
              </label>
              <label>
                评价模板
                <select v-model="experimentForm.rubricTemplateId">
                  <option value="">选择模板</option>
                  <option v-for="rubric in rubricOptionsForCourse(experimentForm.courseId)" :key="rubric.id" :value="rubric.id">
                    {{ rubric.name }} v{{ rubric.version }}
                  </option>
                </select>
              </label>
            </div>
            <label>
              任务标题
              <input v-model="experimentForm.title" placeholder="软件实训成果提交与验收" />
            </label>
            <label>
              实训要求
              <textarea v-model="experimentForm.requirementText" placeholder="列出功能、步骤、报告、截图、代码等提交要求。" />
            </label>
            <label>
              截止时间
              <input v-model="experimentForm.dueAt" type="datetime-local" />
            </label>
            <button
              :disabled="isBusy || !experimentForm.courseId || !experimentForm.rubricTemplateId || !experimentForm.title || !experimentForm.requirementText"
              type="submit"
            >
              创建实训任务
            </button>
          </form>
        </div>
      </article>

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
              <section v-if="canInspectContext" class="context-panel">
                <div class="card-header">
                  <div>
                    <span class="panel-kicker">Context Snapshot</span>
                    <h3>评分上下文快照</h3>
                  </div>
                  <button class="ghost-button" :disabled="isBusy || !selectedSubmissionId" type="button" @click="loadContextSnapshotsForSelection">
                    刷新快照
                  </button>
                </div>
                <div v-if="currentContextSnapshot" class="context-layout">
                  <div class="context-meta">
                    <span>版本 {{ currentContextSnapshot.contextVersion }}</span>
                    <strong>{{ currentContextSnapshot.status }}</strong>
                    <small>{{ currentContextSnapshot.promptVersion }} · {{ formatDate(currentContextSnapshot.createdAt) }}</small>
                    <small>
                      {{ currentContextSnapshot.redactedCharCount }}/{{ currentContextSnapshot.originalCharCount }}
                      · {{ currentContextSnapshot.truncated ? '已截断' : '未截断' }}
                    </small>
                    <small>{{ currentContextSnapshot.inputHash.slice(0, 16) }}</small>
                  </div>
                  <pre class="context-text">{{ currentContextSnapshot.contextText }}</pre>
                  <ul v-if="contextHistory.length > 0" class="context-history">
                    <li v-for="snapshot in contextHistory" :key="snapshot.id">
                      <button
                        :class="{ 'is-active': snapshot.id === currentContextSnapshot.id }"
                        type="button"
                        @click="selectContextSnapshot(snapshot.id)"
                      >
                        <span>{{ snapshot.status }}</span>
                        <strong>{{ snapshot.contextVersion }}</strong>
                        <small>{{ formatDate(snapshot.createdAt) }}</small>
                      </button>
                    </li>
                  </ul>
                </div>
                <div v-else class="empty-state">当前提交还没有生成上下文快照；完成解析并进入评价链路后会在这里显示。</div>
              </section>
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
            <input v-model="uploadForm.experimentId" placeholder="可从顶部选择，也可手动输入 experimentId" />
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
          <label v-if="uploadForm.kind !== 'git_link'">
            选择文件
            <input type="file" @change="handleUploadFileChange" />
          </label>
          <template v-else>
            <label>
              Git 仓库链接
              <input v-model="gitLinkForm.url" placeholder="https://github.com/org/repo 或 tree/blob 链接" />
            </label>
            <label>
              分支
              <input v-model="gitLinkForm.branch" placeholder="可选，例如 main" />
            </label>
            <label>
              Commit
              <input v-model="gitLinkForm.commitSha" placeholder="可选，7-40 位十六进制" />
            </label>
          </template>
          <div class="actions">
            <button :disabled="isBusy || !canSubmitArtifact" type="submit">上传并排队解析</button>
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
import type {
  ArtifactKind,
  AuditLog,
  ClassGroup,
  Course,
  Enrollment,
  Evaluation,
  EvaluationContextSnapshot,
  Experiment,
  Job,
  MetricScore,
  ReportExport,
  ReportStatistics,
  RubricTemplate,
  Submission,
  UserSummary,
  UserRole,
} from './types/api';

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
const courses = ref<Course[]>([]);
const classes = ref<ClassGroup[]>([]);
const experiments = ref<Experiment[]>([]);
const rubrics = ref<RubricTemplate[]>([]);
const users = ref<UserSummary[]>([]);
const enrollments = ref<Enrollment[]>([]);
const evaluation = ref<Evaluation | null>(null);
const selectedSubmissionId = ref('');
const selectedCourseId = ref('');
const selectedClassId = ref('');
const selectedExperimentId = ref('');
const selectedStudentId = ref('');
const selectedSubmissionStatus = ref('');
const teacherComment = ref('');
const metricReviewDraft = reactive<Record<string, { teacherScore: string; comment: string }>>({});
const publishedFeedback = ref<Evaluation | null>(null);
const currentContextSnapshot = ref<EvaluationContextSnapshot | null>(null);
const contextHistory = ref<EvaluationContextSnapshot[]>([]);
const courseForm = reactive({
  name: '',
  code: '',
  description: '',
});
const classForm = reactive({
  name: '',
  grade: '',
  major: '',
});
const foundationSelection = reactive({
  courseId: '',
  classId: '',
});
const userForm = reactive({
  role: 'student' as UserRole,
  username: '',
  displayName: '',
  initialPassword: '',
  studentNo: '',
  teacherNo: '',
});
const enrollmentForm = reactive({
  studentId: '',
  courseId: '',
  classId: '',
});
const rubricForm = reactive({
  courseId: '',
  name: '软件实训综合评价模板',
  description: '围绕功能实现、代码质量、文档规范和过程证据的默认评价模板。',
});
const experimentForm = reactive({
  courseId: '',
  rubricTemplateId: '',
  title: '',
  requirementText: '',
  dueAt: '',
});
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
const gitLinkForm = reactive({
  url: '',
  branch: '',
  commitSha: '',
});

const artifactKindOptions: Array<{ value: ArtifactKind; label: string }> = [
  { value: 'pdf', label: 'PDF 报告' },
  { value: 'word', label: 'Word 文档' },
  { value: 'image', label: '界面截图' },
  { value: 'code_archive', label: '代码压缩包' },
  { value: 'git_link', label: 'Git 链接' },
  { value: 'other', label: '其他文本材料' },
];
const defaultRubricMetrics = [
  {
    name: '功能实现度',
    description: '核心功能、需求覆盖和可演示结果。',
    weight: 40,
    maxScore: 100,
    scoringRule: '检查需求覆盖、功能完整性和运行/截图证据。',
  },
  {
    name: '代码质量',
    description: '结构清晰度、可维护性、异常处理和基础安全。',
    weight: 25,
    maxScore: 100,
    scoringRule: '检查代码结构、命名、重复度、异常处理和明显风险。',
  },
  {
    name: '文档规范性',
    description: '报告格式、关键章节、图表截图和复现实训说明。',
    weight: 20,
    maxScore: 100,
    scoringRule: '检查报告完整性、格式规范、截图证据和说明清晰度。',
  },
  {
    name: '过程完整性',
    description: '实训步骤、测试记录、问题分析和改进说明。',
    weight: 15,
    maxScore: 100,
    scoringRule: '检查步骤记录、测试说明、问题定位和改进过程。',
  },
];

const canManageFoundation = computed(() => sessionUser.value?.role === 'admin' || sessionUser.value?.role === 'teacher');
const canManageUsers = computed(() => sessionUser.value?.role === 'admin');
const canInspectContext = computed(() => sessionUser.value?.role === 'admin' || sessionUser.value?.role === 'teacher');
const canSubmitArtifact = computed(() => {
  if (uploadForm.kind === 'git_link') {
    return gitLinkForm.url.trim().length > 0;
  }
  return uploadForm.file !== null;
});
const runningJobCount = computed(() => jobs.value.filter((job) => job.status === 'running').length);
const studentUsers = computed(() => users.value.filter((user) => user.role === 'student'));
const filteredStudentOptions = computed(() => {
  let candidates = studentUsers.value;
  if (!selectedCourseId.value && !selectedClassId.value) {
    return candidates;
  }
  const studentIds = new Set(
    enrollments.value
      .filter((enrollment) => (!selectedCourseId.value || enrollment.courseId === selectedCourseId.value) && (!selectedClassId.value || enrollment.classId === selectedClassId.value))
      .map((enrollment) => enrollment.studentId),
  );
  candidates = candidates.filter((user) => studentIds.has(user.id));
  return candidates;
});
const filteredExperiments = computed(() => {
  if (!selectedCourseId.value) {
    return experiments.value;
  }
  return experiments.value.filter((experiment) => experiment.courseId === selectedCourseId.value);
});
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
const submissionStatusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'parsing', label: '解析中' },
  { value: 'evaluating', label: '评价中' },
  { value: 'teacher_review', label: '待复核' },
  { value: 'published', label: '已发布' },
  { value: 'failed', label: '失败' },
];

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
    courses.value = snapshot.courses;
    classes.value = snapshot.classes;
    experiments.value = snapshot.experiments;
    rubrics.value = snapshot.rubrics;
    users.value = snapshot.users;
    enrollments.value = snapshot.enrollments;
    evaluation.value = snapshot.evaluation;
    selectedSubmissionId.value = snapshot.evaluation?.submissionId ?? snapshot.submissions[0]?.id ?? '';
    teacherComment.value = snapshot.evaluation?.teacherComment ?? '';
    resetMetricReviewDraft(snapshot.evaluation?.metricScores ?? []);
    publishedFeedback.value = null;
    if (canInspectContext.value && selectedSubmissionId.value) {
      await loadContextSnapshots(selectedSubmissionId.value);
    } else {
      currentContextSnapshot.value = null;
      contextHistory.value = [];
    }
    if (selectedCourseId.value || selectedClassId.value || selectedExperimentId.value || selectedStudentId.value || selectedSubmissionStatus.value) {
      await applyDashboardFilters(false);
    }
  });
}

async function createUserFromForm() {
  await withBusy(async () => {
    const created = await apiClient.createUser({
      role: userForm.role,
      username: userForm.username.trim(),
      displayName: userForm.displayName.trim(),
      initialPassword: userForm.initialPassword,
      studentNo: userForm.role === 'student' ? userForm.studentNo.trim() || undefined : undefined,
      teacherNo: userForm.role === 'teacher' ? userForm.teacherNo.trim() || undefined : undefined,
    });
    users.value = await apiClient.listUsers();
    if (created.role === 'student') {
      enrollmentForm.studentId = created.id;
    }
    resetUserForm();
    viewMessage.value = '用户已创建。';
  });
}

async function createCourseFromForm() {
  await withBusy(async () => {
    const course = await apiClient.createCourse({
      name: courseForm.name.trim(),
      code: courseForm.code.trim(),
      description: courseForm.description.trim() || undefined,
    });
    courses.value = await apiClient.listCourses();
    selectedCourseId.value = course.id;
    foundationSelection.courseId = course.id;
    rubricForm.courseId = course.id;
    experimentForm.courseId = course.id;
    resetCourseForm();
    viewMessage.value = '课程已创建。';
  });
}

async function createClassFromForm() {
  await withBusy(async () => {
    const classGroup = await apiClient.createClass({
      name: classForm.name.trim(),
      grade: classForm.grade.trim() || undefined,
      major: classForm.major.trim() || undefined,
    });
    classes.value = await apiClient.listClasses();
    selectedClassId.value = classGroup.id;
    foundationSelection.classId = classGroup.id;
    resetClassForm();
    viewMessage.value = '班级已创建。';
  });
}

async function attachSelectedClass() {
  await withBusy(async () => {
    await apiClient.attachClassToCourse(foundationSelection.courseId, foundationSelection.classId);
    selectedCourseId.value = foundationSelection.courseId;
    selectedClassId.value = foundationSelection.classId;
    viewMessage.value = '课程和班级已绑定。';
  });
}

async function createEnrollmentFromForm() {
  await withBusy(async () => {
    const enrollment = await apiClient.createEnrollment({
      studentId: enrollmentForm.studentId,
      courseId: enrollmentForm.courseId,
      classId: enrollmentForm.classId,
    });
    enrollments.value = await apiClient.listEnrollments();
    selectedCourseId.value = enrollment.courseId;
    selectedClassId.value = enrollment.classId;
    selectedStudentId.value = enrollment.studentId;
    resetEnrollmentForm();
    viewMessage.value = '学生选课分班已保存。';
  });
}

async function createRubricFromForm() {
  await withBusy(async () => {
    const rubric = await apiClient.createRubric({
      courseId: rubricForm.courseId,
      name: rubricForm.name.trim(),
      description: rubricForm.description,
      metrics: defaultRubricMetrics.map((metric, index) => ({
        ...metric,
        allowTeacherOverride: true,
        sortOrder: index,
      })),
    });
    rubrics.value = await apiClient.listRubrics();
    experimentForm.courseId = rubric.courseId;
    experimentForm.rubricTemplateId = rubric.id;
    viewMessage.value = '评价模板已创建。';
  });
}

async function createExperimentFromForm() {
  await withBusy(async () => {
    const experiment = await apiClient.createExperiment({
      courseId: experimentForm.courseId,
      rubricTemplateId: experimentForm.rubricTemplateId,
      title: experimentForm.title.trim(),
      requirementText: experimentForm.requirementText.trim(),
      dueAt: experimentForm.dueAt ? new Date(experimentForm.dueAt).toISOString() : undefined,
      allowedArtifactKinds: artifactKindOptions.map((option) => option.value),
    });
    experiments.value = await apiClient.listExperiments();
    selectedCourseId.value = experiment.courseId;
    selectedExperimentId.value = experiment.id;
    uploadForm.experimentId = experiment.id;
    resetExperimentForm({ keepCourseId: experiment.courseId, keepRubricTemplateId: experiment.rubricTemplateId });
    viewMessage.value = '实训任务已创建，可直接上传成果。';
  });
}

async function handleCourseSelection() {
  if (!selectedCourseId.value) {
    experiments.value = await apiClient.listExperiments();
    rubrics.value = await apiClient.listRubrics();
    selectedStudentId.value = '';
    if (selectedExperimentId.value && !experiments.value.some((experiment) => experiment.id === selectedExperimentId.value)) {
      selectedExperimentId.value = '';
    }
    return;
  }
  const [courseExperiments, courseRubrics] = await Promise.all([
    apiClient.listExperiments(selectedCourseId.value),
    apiClient.listRubrics(selectedCourseId.value),
  ]);
  experiments.value = courseExperiments;
  rubrics.value = courseRubrics;
  rubricForm.courseId = selectedCourseId.value;
  experimentForm.courseId = selectedCourseId.value;
  if (uploadForm.experimentId && !experiments.value.some((experiment) => experiment.id === uploadForm.experimentId)) {
    uploadForm.experimentId = '';
  }
  if (selectedExperimentId.value && !experiments.value.some((experiment) => experiment.id === selectedExperimentId.value)) {
    selectedExperimentId.value = '';
  }
  if (selectedStudentId.value && !filteredStudentOptions.value.some((student) => student.id === selectedStudentId.value)) {
    selectedStudentId.value = '';
  }
  syncExperimentRubric();
}

function handleClassSelection() {
  if (selectedStudentId.value && !filteredStudentOptions.value.some((student) => student.id === selectedStudentId.value)) {
    selectedStudentId.value = '';
  }
}

function syncSelectedExperiment() {
  uploadForm.experimentId = selectedExperimentId.value;
}

function syncExperimentRubric() {
  const options = rubricOptionsForCourse(experimentForm.courseId);
  if (!options.some((rubric) => rubric.id === experimentForm.rubricTemplateId)) {
    experimentForm.rubricTemplateId = options[0]?.id ?? '';
  }
}

function rubricOptionsForCourse(courseId: string) {
  if (!courseId) {
    return rubrics.value;
  }
  return rubrics.value.filter((rubric) => rubric.courseId === courseId);
}

async function applyReportFilters() {
  await applyDashboardFilters(true);
}

async function applyDashboardFilters(announce: boolean) {
  await withBusy(async () => {
    submissions.value = await apiClient.listSubmissions({
      courseId: selectedCourseId.value || undefined,
      classId: selectedClassId.value || undefined,
      experimentId: selectedExperimentId.value || undefined,
      studentId: selectedStudentId.value || undefined,
      status: selectedSubmissionStatus.value || undefined,
    });
    statistics.value = await apiClient.getReportStatistics({
      courseId: selectedCourseId.value || undefined,
      classId: selectedClassId.value || undefined,
      experimentId: selectedExperimentId.value || undefined,
      studentId: selectedStudentId.value || undefined,
    });
    await syncSelectionAfterSubmissionRefresh();
    if (announce) {
      viewMessage.value = '报表与提交筛选已应用。';
    }
  });
}

async function selectSubmission(submissionId: string) {
  await withBusy(async () => {
    selectedSubmissionId.value = submissionId;
    evaluation.value = await loadEvaluationForCurrentRole(submissionId);
    teacherComment.value = evaluation.value?.teacherComment ?? '';
    resetMetricReviewDraft(evaluation.value?.metricScores ?? []);
    publishedFeedback.value = null;
    if (canInspectContext.value) {
      await loadContextSnapshots(submissionId);
    } else {
      currentContextSnapshot.value = null;
      contextHistory.value = [];
    }
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
  if (uploadForm.kind !== 'git_link' && !uploadForm.file) {
    viewError.value = '请选择需要上传的成果文件。';
    return;
  }
  if (uploadForm.kind === 'git_link' && !gitLinkForm.url.trim()) {
    viewError.value = '请填写 Git 仓库链接。';
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

    const artifact =
      uploadForm.kind === 'git_link'
        ? await apiClient.createGitLinkArtifact(submissionId, {
            url: gitLinkForm.url.trim(),
            branch: gitLinkForm.branch.trim() || undefined,
            commitSha: gitLinkForm.commitSha.trim() || undefined,
          })
        : await apiClient.uploadArtifact(submissionId, uploadForm.kind, uploadForm.file as File);
    viewMessage.value = `成果 ${artifact.originalName} 已上传，解析任务已入队。`;
    uploadForm.file = null;
    if (uploadForm.kind === 'git_link') {
      resetGitLinkForm();
    }
    submissions.value = await apiClient.listSubmissions({
      courseId: selectedCourseId.value || undefined,
      classId: selectedClassId.value || undefined,
      experimentId: selectedExperimentId.value || undefined,
      studentId: selectedStudentId.value || undefined,
      status: selectedSubmissionStatus.value || undefined,
    });
    jobs.value = await apiClient.listJobs();
    auditLogs.value = await apiClient.listAuditLogs();
    await syncSelectionAfterSubmissionRefresh();
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

async function loadContextSnapshotsForSelection() {
  if (!selectedSubmissionId.value || !canInspectContext.value) {
    return;
  }
  await withBusy(async () => {
    await loadContextSnapshots(selectedSubmissionId.value);
    viewMessage.value = '上下文快照已刷新。';
  });
}

async function selectContextSnapshot(snapshotId: string) {
  const snapshot = contextHistory.value.find((item) => item.id === snapshotId);
  if (!snapshot) {
    return;
  }
  currentContextSnapshot.value = snapshot;
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
  resetGitLinkForm();
}

function resetGitLinkForm() {
  gitLinkForm.url = '';
  gitLinkForm.branch = '';
  gitLinkForm.commitSha = '';
}

function resetUserForm() {
  userForm.role = 'student';
  userForm.username = '';
  userForm.displayName = '';
  userForm.initialPassword = '';
  userForm.studentNo = '';
  userForm.teacherNo = '';
}

function resetEnrollmentForm() {
  enrollmentForm.studentId = '';
  enrollmentForm.courseId = '';
  enrollmentForm.classId = '';
}

function resetCourseForm() {
  courseForm.name = '';
  courseForm.code = '';
  courseForm.description = '';
}

function resetClassForm() {
  classForm.name = '';
  classForm.grade = '';
  classForm.major = '';
}

function resetExperimentForm(options: { keepCourseId: string; keepRubricTemplateId: string }) {
  experimentForm.courseId = options.keepCourseId;
  experimentForm.rubricTemplateId = options.keepRubricTemplateId;
  experimentForm.title = '';
  experimentForm.requirementText = '';
  experimentForm.dueAt = '';
}

async function syncSelectionAfterSubmissionRefresh() {
  if (submissions.value.length === 0) {
    selectedSubmissionId.value = '';
    evaluation.value = null;
    publishedFeedback.value = null;
    return;
  }
  if (!submissions.value.some((submission) => submission.id === selectedSubmissionId.value)) {
    selectedSubmissionId.value = submissions.value[0].id;
  }
  evaluation.value = selectedSubmissionId.value ? await loadEvaluationForCurrentRole(selectedSubmissionId.value) : null;
  teacherComment.value = evaluation.value?.teacherComment ?? '';
  resetMetricReviewDraft(evaluation.value?.metricScores ?? []);
  if (canInspectContext.value && selectedSubmissionId.value) {
    await loadContextSnapshots(selectedSubmissionId.value);
  } else {
    currentContextSnapshot.value = null;
    contextHistory.value = [];
  }
}

async function loadEvaluationForCurrentRole(submissionId: string) {
  if (sessionUser.value?.role === 'student') {
    try {
      return await apiClient.getPublishedEvaluation(submissionId);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }
  return apiClient.getEvaluation(submissionId);
}

async function loadContextSnapshots(submissionId: string) {
  try {
    const [latest, history] = await Promise.all([
      apiClient.getLatestEvaluationContext(submissionId),
      apiClient.getEvaluationContextHistory(submissionId),
    ]);
    currentContextSnapshot.value = latest;
    contextHistory.value = history;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      currentContextSnapshot.value = null;
      contextHistory.value = [];
      return;
    }
    throw error;
  }
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
