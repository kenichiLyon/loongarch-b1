# AGENT.md

本文件固定本项目所有 agent 和开发者的开发流程。任何会修改仓库内容的操作，都必须形成 GitHub 远端 commit，并优先通过 GitHub MCP 完成版本控制。

## 1. 项目固定目标

- 项目名称：基于大模型技术的软件实训教学结果检查评价与报表系统。
- 首版形态：PC Web B/S 系统。
- 首版周期：12 周 MVP + 试点验收。
- 部署目标：自主指令系统 LoongArch 架构 + 银河麒麟高级服务器版。
- 开发环境：amd64 Windows + Linux，必须持续考虑跨平台调试与 LoongArch 目标环境差异。
- 技术栈基线：Vue 3 + TypeScript + NestJS + PostgreSQL + 本地对象存储。
- 大模型策略：云端 OpenAI-compatible API 优先，本地/局域网模型服务可插拔；业务代码不得直接依赖具体模型 SDK。

## 2. 启动前检查

每轮工作开始前必须执行以下检查：

1. 确认当前目录是否为 Git 仓库，并检查是否存在未理解的本地变更。
2. 确认 GitHub 远端仓库是否存在，默认仓库为 `kenichiLyon/loongarch-b1`。
3. 如果没有对应远端仓库，必须先通过 GitHub MCP `get_me` 获取当前用户，再通过 GitHub MCP 创建私有仓库。
4. 读取 `AGENT.md`、`README.md`、开发文档和相关代码后再修改。
5. 将需求拆分为最小可验证工作单元，明确每个工作单元的验收方式。

只读探索不需要提交 commit；一旦修改文件，必须按本文件的版本控制规则提交到远端。

## 3. GitHub MCP 版本控制规则

本项目强制执行远端优先的版本控制流程：

- 每个会修改仓库内容的工作单元都必须形成 GitHub 远端 commit。
- 优先使用 GitHub MCP 的 `push_files`、`create_or_update_file`、`create_branch`、`create_pull_request` 等工具提交远端变更。
- 每次提交必须走 Pull Request 流程，并与 Sourcery AI review 互动；如 Sourcery AI 发现实质性问题必须修复后再合并，如判断无实质性问题则需在 PR 中说明证据和理由、说服 Sourcery AI 后再合并。
- 禁止只在本地修改而不提交远端。
- 每轮开发结束前必须确认远端仓库包含最新 commit。
- 如果 GitHub MCP、网络或权限异常导致无法提交远端，必须停止后续开发并报告阻塞原因。
- 不得提交密钥、Token、真实学生隐私数据、云端模型 API Key 或生产数据。
- 不得使用 `git reset --hard`、强制推送、删除远端分支等破坏性操作，除非用户明确要求。

### 分支策略

- `main`：稳定主分支，保存阶段性可运行结果和治理文档。
- `develop`：日常集成分支，可在进入多人开发或复杂功能后启用。
- `feature/<scope>`：功能开发分支，例如 `feature/project-scaffold`、`feature/upload-parser`。
- `fix/<scope>`：缺陷修复分支。
- 禁止直接提交到 `main`；所有修改必须通过 feature/fix/docs 分支提交 PR，经 CI/CD 与 Sourcery AI review 后合并。

### Commit Message 规范

使用 Conventional Commits：

- 格式：`type(scope): summary`
- 类型：`feat`、`fix`、`docs`、`test`、`refactor`、`chore`、`ci`、`build`
- 禁止使用 `update`、`misc`、`wip` 作为最终提交信息。
- 如果提交包含未完成能力，必须在 summary 或正文中标注 `partial` 并说明限制。

推荐提交顺序：

1. `chore(governance): add agent workflow`
2. `docs(project): add project charter and roadmap`
3. `chore(scaffold): initialize workspace skeleton`
4. 后续按业务模块提交，如 `feat(api): add rbac domain model`、`feat(api): add submission upload workflow`。

## 4. 工作单元执行流程

每个工作单元必须按以下顺序执行：

1. 阅读相关代码、文档、配置和已有测试。
2. 明确本次变更目标、影响范围、验收方式和 LoongArch 影响。
3. 修改最少必要文件，避免把无关功能混入同一工作单元。
4. 执行与变更范围相关的最小检查。
5. 如检查失败，优先修复；如必须提交失败状态，commit message 或文档必须说明失败原因和后续动作。
6. 通过 GitHub MCP 提交远端 commit。
7. 同步本地文件状态，确认没有未说明的 repo-tracked 变更。

## 5. 技术与架构约束

- 前端采用 Vue 3、Vite、TypeScript、Element Plus、ECharts。
- 后端采用 NestJS、TypeScript、PostgreSQL。
- 数据库访问优先选择跨平台方案；避免引入未验证 LoongArch 可用性的关键 native 依赖。
- 文件存储必须通过 `ObjectStore` 抽象，首版实现本地文件存储，预留 MinIO/S3 兼容实现。
- LLM 调用必须通过统一 `LLM Gateway`，支持云端和本地/局域网 OpenAI-compatible 服务。
- 文件解析必须先做确定性解析，再把脱敏摘要和证据片段交给 LLM；不得把原始学生文件默认发送到云端模型。
- 智能评价只能作为初评；最终成绩必须由教师确认，或由系统规则显式发布并留痕。
- 报表导出必须异步执行，Excel/PDF 文件写入对象存储并记录生成条件、生成时间、操作者。
- 代码包首版只做静态扫描，不自动运行学生代码，不引入执行沙箱作为首版阻塞项。

## 6. 安全与合规规则

- 上传文件必须限制大小、类型和数量，并检测 MIME 与扩展名不一致的风险。
- 压缩包解析必须防止 Zip Slip、路径穿越和超大解压。
- 学生姓名、学号、联系方式等敏感信息在云端 LLM 调用前必须脱敏或最小化。
- Prompt 中必须防止上传内容覆盖评分规则，业务评分规则和系统约束优先级最高。
- API Key 只能通过环境变量或安全配置注入，不得写入仓库。
- 所有关键操作需要审计：上传、解析、LLM 调用、教师改分、结果发布、报表导出。

## 7. 测试与验收规则

- 后端新增业务逻辑必须配套单元测试或集成测试。
- 前端新增关键页面必须至少保证构建通过。
- 上传、解析、评分、教师复核、报表导出属于核心链路，必须维护可重复测试样例。
- 每次提交前至少运行与变更范围相关的最小检查。
- 阶段性提交必须运行完整构建或完整测试。
- 验收数据至少包含 1 门课程、2 个班级、50 份以上学生提交样例。

## 8. LoongArch 与银河麒麟适配规则

- LoongArch 兼容性必须前置验证，不得推迟到项目后期。
- 所有新增依赖都要评估是否包含 native binary、是否支持源码编译、是否可在银河麒麟软件源中获取。
- PDF 中文字体、Excel 导出、文件解析、OCR/Office 转换等能力必须记录目标环境验证结果。
- 默认提供 systemd 非容器部署方案，同时维护 Docker/Podman 容器部署方案。
- 如果某能力在目标环境缺失，必须提供降级行为和人工处理入口，而不是直接阻塞主流程。

## 9. 12 周执行路线

- 第 0 周：仓库治理、`AGENT.md`、`README.md`、基础目录、提交规范、敏感信息规则。
- 第 1-2 周：前后端骨架、环境变量模板、健康检查、基础数据模型、LoongArch 依赖风险清单。
- 第 3-4 周：学生提交、文件存储、解析任务、Word/PDF/截图/代码包基础解析、样例数据。
- 第 5-6 周：规则核查、LLM Gateway、脱敏摘要、JSON Schema 校验、智能初评和失败重试。
- 第 7-8 周：教师复核、逐项改分、评语、评价模板版本化、学生反馈查看。
- 第 9 周：个人报告、班级/课程统计、Excel/PDF 异步导出、图表嵌入。
- 第 10 周：LoongArch + 银河麒麟完整部署演练、systemd、容器方案、冒烟测试记录。
- 第 11 周：安全测试、批量试跑、性能基线、日志与失败任务治理。
- 第 12 周：演示数据、用户手册、部署手册、验收包、最终版本 tag。

## 10. 完成标准

每个工作单元完成时必须满足：

- 代码或文档已经通过 GitHub MCP 提交到远端仓库。
- 本地与远端内容一致，或明确记录差异原因。
- 验证结果已记录在最终回复、commit message 或相关文档中。
- 没有未说明的工作区变更。
- 没有新增密钥、隐私数据或未评估的高风险依赖。
