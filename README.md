# loongarch-b1

基于大模型技术的软件实训教学结果检查评价与报表系统，面向高校/职教软件实训课程，提供成果提交、自动解析、智能核查、多维评价、教师复核、统计报表和国产化部署支持。

## 1. 项目定位

本系统不是用大模型直接替代教师评分，而是把大模型作为“初评与核查助手”：

- 先通过确定性解析和规则引擎检查提交物完整性、格式、结构和关键证据。
- 再通过统一 LLM Gateway 对脱敏摘要和证据片段进行辅助评价。
- 最终成绩由教师逐项复核、改分、写评语并确认发布。
- 全流程保留审计记录，便于教学质量分析和后续复查。

## 2. 首版范围

### 已纳入 MVP

- PC Web 可视化界面。
- 管理员、教师、学生三类角色。
- 课程、班级、实训任务、评价模板与指标权重。
- Word、PDF、报告、截图、代码包、Git 链接等成果入口。
- 文件解析、规则核查、LLM 初评、教师复核、结果发布。
- 学生个人报告、班级/课程统计报表、Excel/PDF 导出。
- LoongArch + 银河麒麟高级服务器版部署适配。

### 首版暂不承诺

- 不自动运行学生代码，不引入执行沙箱作为首版阻塞项。
- 不承诺本地模型效果与云端模型完全一致。
- 不默认把原始学生文件发送给云端大模型。
- 不在首版开发移动 App，优先保证 PC Web 完整闭环。

## 3. 技术栈

| 层级 | 技术 | 说明 |
| --- | --- | --- |
| 前端 | Vue 3 + Vite + TypeScript | PC Web 工作台 |
| UI/图表 | Element Plus + ECharts | 后台表单、表格、统计图 |
| 后端 | NestJS + TypeScript | 模块化 API 服务 |
| 数据库 | PostgreSQL | 结构化业务数据、任务状态、评分结果 |
| 文件存储 | Local ObjectStore | 首版本地对象存储，预留 MinIO/S3 |
| 大模型 | OpenAI-compatible HTTP API | 云端优先，本地/局域网模型服务可插拔 |
| 部署 | systemd + Docker/Podman | 同时维护非容器与容器方案 |

## 4. 仓库结构

```text
apps/
  api/      NestJS 后端服务
  web/      Vue 3 前端应用
docs/
  ARCHITECTURE.md              架构概要
  CONCURRENCY.md               高并发与异步任务策略
  DATA_MODEL.md                核心数据模型
  DATABASE_MIGRATIONS.md       数据库迁移说明
  DEPENDENCY_POLICY.md         依赖锁定策略
  LOONGARCH_COMPATIBILITY.md   LoongArch/银河麒麟兼容性清单
  LOONGARCH_DEPENDENCY_RISK.md LoongArch lockfile 风险扫描报告
  RELEASE.md                   CD 自动构建产物发布说明
  ROADMAP.md                   12 周交付路线图
  SECURITY.md                  安全与合规基线
fixtures/                      非敏感测试样例说明
scripts/                       开发、检查、部署辅助脚本
AGENT.md                       agent 固定开发流程
```

## 5. 快速开始

### 环境要求

- Node.js：`>=22 <25`
- pnpm：`>=10`
- PostgreSQL：建议 15+
- 操作系统：开发环境支持 Windows/Linux；目标部署环境为 LoongArch + 银河麒麟高级服务器版。

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env
```

按需修改：

```dotenv
API_PORT=3000
WEB_PORT=5173
DATABASE_URL=postgres://postgres:postgres@localhost:5432/loongarch_b1
DATABASE_HEALTH_TIMEOUT_MS=3000
DATABASE_POOL_MAX=10
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_CONNECTION_TIMEOUT_MS=5000
AUTH_TOKEN_SECRET=dev-only-change-me-please
AUTH_TOKEN_TTL_SECONDS=28800
AUTH_BOOTSTRAP_TOKEN=dev-bootstrap-token
STORAGE_ROOT=./storage
UPLOAD_MAX_BYTES=20971520
PARSER_MAX_TEXT_CHARS=60000
JOB_BATCH_SIZE=5
JOB_POLL_INTERVAL_MS=2000
JOB_RETRY_DELAY_SECONDS=30
JOB_STALE_AFTER_SECONDS=900
EVALUATION_MAX_CONTEXT_CHARS=24000
EVALUATION_PROMPT_VERSION=evaluation-v1
LLM_PROVIDER=cloud
LLM_BASE_URL=https://example.invalid/v1
LLM_API_KEY=
LLM_MODEL=
LLM_TIMEOUT_MS=30000
```

`AUTH_TOKEN_SECRET`、`AUTH_BOOTSTRAP_TOKEN`、`LLM_API_KEY` 不得提交生产真实值；云端调用前必须执行脱敏摘要策略。

### 本地开发

```bash
pnpm dev
```

默认端口：

- 后端 API：`http://localhost:3000/health`
- 数据库健康检查：`http://localhost:3000/health/database`
- 前端 Web：`http://localhost:5173`

### 构建与测试

```bash
pnpm --filter @loongarch-b1/api test
pnpm test:scripts
pnpm lint
pnpm build
pnpm risk:loongarch
```

### 解析 Worker

上传接口只负责保存文件和创建 `parse_artifact` 任务，解析由独立 worker 消费：

```bash
JOB_RUN_ONCE=true pnpm worker:parse
```

生产部署可启动多个 worker 实例并发消费；任务领取使用 PostgreSQL `FOR UPDATE SKIP LOCKED` 避免重复处理。

### 评价 Worker

解析完成后系统会自动创建 `evaluate_submission` 任务。评价 worker 会先运行确定性规则核查，写入 `rule_score` 与核查发现；随后构建脱敏证据摘要并通过 OpenAI-compatible LLM Gateway 执行 JSON 初评。如果未配置 `LLM_BASE_URL`/`LLM_MODEL`，系统仍会保留规则核查结果，并生成“需教师人工复核”的 AI 草稿进入教师复核状态，避免任务永久阻塞。

```bash
JOB_RUN_ONCE=true pnpm worker:evaluate
```

`LLM_PROVIDER=cloud|local` 用于标记云端或本地/局域网模型服务；本地服务可不配置 `LLM_API_KEY`，但必须提供 OpenAI-compatible `/chat/completions` 接口。

当前脚手架验证目标：

- NestJS 后端 TypeScript 编译通过。
- Vue 3 前端 TypeScript 检查和 Vite 构建通过。
- 核心评价指标权重校验测试通过。

## 6. 基础 API

当前已提供第一批管理端基础接口：

- `POST /auth/bootstrap-admin`：仅首个管理员初始化使用，需要 `AUTH_BOOTSTRAP_TOKEN`
- `POST /auth/login`：用户名密码登录，返回 Bearer Token
- `GET /auth/me`：读取当前登录用户
- `GET /users`、`POST /users`
- `GET /classes`、`POST /classes`
- `GET /courses`、`POST /courses`
- `POST /courses/:courseId/classes`
- `GET /rubrics`、`POST /rubrics`
- `GET /experiments`、`POST /experiments`
- `GET /submissions`、`POST /submissions`
- `POST /submissions/:submissionId/artifacts/upload`
- `GET /jobs`、`GET /jobs/:jobId`：管理员/教师查看解析、评价、报表异步任务状态
- `GET /audit-logs`：管理员/教师按动作、实体、操作者筛选审计日志
- `GET /evaluations/submissions/:submissionId`：管理员/教师查看 AI 初评草稿、指标分和核查发现
- `PATCH /evaluations/submissions/:submissionId/review`：管理员/教师逐项填写教师分、评语并确认最终分
- `POST /evaluations/submissions/:submissionId/publish`：管理员/教师发布已复核评价结果
- `GET /evaluations/submissions/:submissionId/published`：学生查看自己已发布的反馈，管理员/教师也可查看

除健康检查和登录/初始化接口外，基础管理接口均需要 Bearer Token；管理员可创建用户，管理员/教师可维护课程、班级、评价模板和实训任务。

### 初始化管理员

空库首次启动后可用以下请求创建第一个管理员：

```bash
curl -X POST http://localhost:3000/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"bootstrapToken":"dev-bootstrap-token","username":"admin","displayName":"管理员","initialPassword":"password-123"}'
```

随后使用 `POST /auth/login` 获取 `accessToken`，调用管理接口时添加：

```bash
Authorization: Bearer <accessToken>
```

### 上传提交物

提交物上传使用本地对象存储，文件写入 `STORAGE_ROOT`，元数据写入 `artifacts` 表，并自动创建 `parse_artifact` 解析任务：

```bash
curl -X POST http://localhost:3000/submissions/<submissionId>/artifacts/upload \
  -H "Authorization: Bearer <accessToken>" \
  -F "kind=pdf" \
  -F "file=@./report.pdf"
```

`UPLOAD_MAX_BYTES` 控制单文件大小，当前支持 `word`、`pdf`、`image`、`code_archive`、`other` 文件类型；`git_link` 将使用后续专用入口。上传使用磁盘临时文件，避免高并发时把完整文件压在 Node.js 内存中。

上传成功会写入 `artifact.uploaded` 审计日志；解析 worker 成功/失败会写入 `artifact.parse_succeeded` 或 `artifact.parse_failed`。解析完成会自动排队 `evaluate_submission` 任务。管理员/教师可用 `GET /jobs?jobType=parse_artifact&submissionId=<id>` 定位异步任务进度，用 `GET /audit-logs?entityType=artifact&entityId=<id>` 查看处理留痕。

## 7. 核心业务流程

1. 管理员创建用户、班级、课程。
2. 教师创建实训任务并配置评价模板。
3. 学生上传报告、截图、代码包或 Git 链接。
4. 系统保存成果并创建解析任务。
5. 解析器提取文本、截图信息、代码结构和文件元数据。
6. 规则引擎检查提交完整性、步骤覆盖、格式规范和明显风险。
7. LLM Gateway 使用脱敏摘要生成 JSON 初评建议、证据、扣分点和置信度。
8. 教师逐项复核、改分、写评语并确认最终成绩。
9. 教师发布评价结果后，学生只能查看自己的已发布反馈。
10. 系统生成学生报告和课程/班级统计报表，支持 Excel/PDF 导出。

## 8. 大模型调用原则

- 所有 LLM 调用必须通过统一 `LLM Gateway`。
- 支持云端 OpenAI-compatible API，也支持本地或局域网模型服务。
- 默认只发送脱敏摘要和必要证据片段，不发送原始文件。
- LLM 输出必须符合后端 JSON Schema，失败时通过 `evaluate_submission` 任务重试，最终失败会留痕并进入人工处理。
- Prompt 中系统评分规则优先，上传内容不得覆盖系统规则。

## 9. LoongArch 与银河麒麟适配

目标部署环境固定为 LoongArch 架构 + 银河麒麟高级服务器版。开发中必须持续记录：

- Node.js LTS 安装方式：系统源、龙芯源或源码编译。
- PostgreSQL 安装、初始化和备份恢复方式。
- PDF/Word/Excel/图片解析依赖是否包含 native binary。
- PDF 中文字体路径、授权和嵌入效果。
- Docker/Podman 基础镜像是否支持 LoongArch。
- 不可用能力的降级策略和人工处理入口。

依赖风险扫描使用：

```bash
pnpm risk:loongarch
```

扫描结果写入 `docs/LOONGARCH_DEPENDENCY_RISK.md`。当前 lockfile 扫描为 381 个包、0 个高风险、30 个中风险、64 个低风险；中风险主要集中在 Linux 平台限定的 esbuild/rollup 可选构建包。详见 `docs/LOONGARCH_COMPATIBILITY.md` 和 `docs/DEPENDENCY_POLICY.md`。

## 10. 自动构建与发布

本项目已配置 CD 工作流：

- 推送 `main` 或手动触发时，GitHub Actions 会运行测试、构建前后端，并上传 auto build artifact。
- 推送 `v*` tag 时，会额外创建 GitHub Release 并附带 Web/API/Docs 压缩包和 `BUILD_MANIFEST.json`。
- CI/CD 均运行 `pnpm lint`；配置 `SOURCERY_TOKEN` 后，CI/CD 会执行 Sourcery AI 自动代码审核。
- 发布细节见 `docs/RELEASE.md`。

## 11. 高并发策略

- API 上传链路：文件先落磁盘临时区，再写入本地 ObjectStore，数据库只保存元数据。
- 异步任务：上传后创建 `jobs`，解析 worker 独立消费，避免请求线程执行重解析。
- 并发领取：解析 worker 与评价 worker 使用 `FOR UPDATE SKIP LOCKED` 批量领取任务，支持多实例横向扩展。
- 失败治理：任务失败会延迟重试，超出 `max_attempts` 后进入失败状态；stale running job 会被释放回队列。
- 运行可观测：`GET /jobs` 和 `GET /audit-logs` 均限制单次返回数量，并使用 PostgreSQL 索引支撑教师端排查。
- 详细策略见 `docs/CONCURRENCY.md`。

## 12. 版本控制纪律

本项目遵循 `AGENT.md`：

- 每个会修改仓库内容的工作单元必须形成 GitHub 远端 commit。
- 优先通过 GitHub MCP 提交远端变更。
- 不得提交密钥、Token、真实学生隐私数据或生产数据。
- Commit message 使用 Conventional Commits。
- 每次提交前至少运行与变更范围相关的最小检查。

## 13. 当前状态

当前已完成：

- 远端仓库与开发治理文档。
- pnpm monorepo 工程骨架。
- NestJS 后端健康检查接口。
- Vue 3 首屏工作台。
- 核心评价领域契约和权重校验测试。
- 依赖精确版本、pnpm lockfile 和 CI 冻结安装。
- 核心 PostgreSQL 数据模型和初始迁移脚本。
- 数据库迁移执行命令与迁移校验测试。
- GitHub Actions CD 自动构建并上传发布产物。
- 数据库连接健康检查接口。
- 用户、班级、课程、评价模板和实训任务基础 API。
- 基于 scrypt 密码哈希与 HMAC Bearer Token 的登录、首个管理员初始化和 RBAC 守卫。
- ESLint、CI/CD lint gate 与 Sourcery AI 自动代码审核入口。
- 学生提交记录、本地 ObjectStore 文件上传、artifacts 入库和解析任务排队。
- 高并发安全的 PostgreSQL job claiming、解析 worker、`extracted_contents` 写入和任务重试/释放机制。
- LoongArch 依赖风险扫描脚本、生成报告和脚本单元测试。
- 上传/解析审计日志、教师/管理员任务状态查询 API 和相关索引。
- CI 已纳入仓库脚本测试，保证 LoongArch 风险扫描逻辑随 PR 自动验证。
- OpenAI-compatible LLM Gateway、脱敏证据摘要、JSON 初评校验、评价 worker 和 AI 草稿落库。
- 确定性规则核查基础能力：需求覆盖、步骤完整性、文档证据质量、异常/Prompt Injection 风险识别和指标 `rule_score` 落库。
- 教师复核 API：逐项教师分、总评语、最终分确认、发布和学生已发布反馈查看。

下一步：

1. 扩展 Word/PDF/OCR/代码包真实解析器与解析回归样例。
2. 补齐前端登录、任务状态、教师复核、学生反馈和 AI/规则初评查看页面。
3. 推进报表导出 API、统计查询和 Excel/PDF 异步生成。
