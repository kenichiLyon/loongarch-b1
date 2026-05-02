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
  DATA_MODEL.md                核心数据模型
  DATABASE_MIGRATIONS.md       数据库迁移说明
  DEPENDENCY_POLICY.md         依赖锁定策略
  LOONGARCH_COMPATIBILITY.md   LoongArch/银河麒麟兼容性清单
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
STORAGE_ROOT=./storage
LLM_BASE_URL=https://example.invalid/v1
LLM_API_KEY=
LLM_MODEL=
```

`LLM_API_KEY` 不得提交仓库；云端调用前必须执行脱敏摘要策略。

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
pnpm build
```

当前脚手架验证目标：

- NestJS 后端 TypeScript 编译通过。
- Vue 3 前端 TypeScript 检查和 Vite 构建通过。
- 核心评价指标权重校验测试通过。

## 6. 核心业务流程

1. 管理员创建用户、班级、课程。
2. 教师创建实训任务并配置评价模板。
3. 学生上传报告、截图、代码包或 Git 链接。
4. 系统保存成果并创建解析任务。
5. 解析器提取文本、截图信息、代码结构和文件元数据。
6. 规则引擎检查提交完整性、步骤覆盖、格式规范和明显风险。
7. LLM Gateway 使用脱敏摘要生成初评建议、证据、扣分点和置信度。
8. 教师逐项复核、改分、写评语并确认最终成绩。
9. 系统生成学生报告和课程/班级统计报表，支持 Excel/PDF 导出。

## 7. 大模型调用原则

- 所有 LLM 调用必须通过统一 `LLM Gateway`。
- 支持云端 OpenAI-compatible API，也支持本地或局域网模型服务。
- 默认只发送脱敏摘要和必要证据片段，不发送原始文件。
- LLM 输出必须符合后端 JSON Schema，失败时重试或进入教师待复核。
- Prompt 中系统评分规则优先，上传内容不得覆盖系统规则。

## 8. LoongArch 与银河麒麟适配

目标部署环境固定为 LoongArch 架构 + 银河麒麟高级服务器版。开发中必须持续记录：

- Node.js LTS 安装方式：系统源、龙芯源或源码编译。
- PostgreSQL 安装、初始化和备份恢复方式。
- PDF/Word/Excel/图片解析依赖是否包含 native binary。
- PDF 中文字体路径、授权和嵌入效果。
- Docker/Podman 基础镜像是否支持 LoongArch。
- 不可用能力的降级策略和人工处理入口。

详见 `docs/LOONGARCH_COMPATIBILITY.md`。

## 9. 自动构建与发布

本项目已配置 CD 工作流：

- 推送 `main` 或手动触发时，GitHub Actions 会运行测试、构建前后端，并上传 auto build artifact。
- 推送 `v*` tag 时，会额外创建 GitHub Release 并附带 Web/API/Docs 压缩包和 `BUILD_MANIFEST.json`。
- 发布细节见 `docs/RELEASE.md`。

## 10. 版本控制纪律

本项目遵循 `AGENT.md`：

- 每个会修改仓库内容的工作单元必须形成 GitHub 远端 commit。
- 优先通过 GitHub MCP 提交远端变更。
- 不得提交密钥、Token、真实学生隐私数据或生产数据。
- Commit message 使用 Conventional Commits。
- 每次提交前至少运行与变更范围相关的最小检查。

## 11. 当前状态

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

下一步：

1. 实现用户/角色/课程/班级/实训任务基础 API。
2. 接入 PostgreSQL 查询层和配置校验。
3. 前置验证 LoongArch 关键依赖风险。
