# 核心数据模型

本文件定义第 1-2 周的 PostgreSQL 数据模型边界。模型服务于 MVP 主流程：用户与权限、课程班级、实训任务、成果提交、解析核查、智能初评、教师复核、报表导出和审计。

## 1. 设计原则

- 使用 PostgreSQL 作为唯一结构化数据源，减少首版部署组件数量。
- 所有业务主键使用 UUID，便于导入、迁移和分布式任务引用。
- 评分模板必须版本化，历史提交关联当时的模板版本，不受后续模板修改影响。
- LLM 只保存脱敏输入摘要 hash、模型信息、输出 JSON 和调用状态，不保存真实 API Key。
- 文件正文和导出文件不进数据库，只保存对象存储 key、hash、大小、类型和状态。
- 教师确认后的最终成绩不可被后台任务覆盖，修改必须产生审计记录。

## 2. 核心实体

| 实体 | 表名 | 说明 |
| --- | --- | --- |
| 用户 | `users` | 管理员、教师、学生统一账号 |
| 班级 | `classes` | 教学班级 |
| 课程 | `courses` | 实训课程 |
| 课程班级 | `course_classes` | 课程和班级的授权关系 |
| 学生选课 | `enrollments` | 学生、课程、班级关系 |
| 实训任务 | `experiments` | 教师发布的实训要求 |
| 评价模板 | `rubric_templates` | 指标集合和版本 |
| 评价指标 | `rubric_metrics` | 指标名称、权重、评分规则 |
| 提交 | `submissions` | 学生对某个实训任务的提交记录 |
| 成果文件 | `artifacts` | 上传文件或 Git 链接元信息 |
| 解析内容 | `extracted_contents` | 文本片段、OCR、代码结构摘要 |
| 评价结果 | `evaluation_results` | AI 初评、教师复核、发布状态 |
| 指标得分 | `metric_scores` | 每个指标的确定性规则分、AI 分、教师分、最终分 |
| 核查发现 | `verification_findings` | 步骤缺失、逻辑风险、文档/代码问题 |
| LLM 调用 | `llm_call_logs` | 模型、输入 hash、输出、耗时、错误 |
| 报表导出 | `report_exports` | Excel/PDF 导出任务和文件位置 |
| 审计日志 | `audit_logs` | 关键操作留痕 |
| 后台任务 | `jobs` | 解析、评价、导出等异步任务 |

`metric_scores.comments` 固定保存为 JSON 数组；当规则核查和 AI 初评都没有评论时保存 `[]`，便于前端按统一结构渲染。

## 3. 状态枚举

- `submissions.status`：`draft`、`submitted`、`parsing`、`evaluating`、`teacher_review`、`published`、`failed`
- `artifacts.status`：`uploaded`、`parsing`、`parsed`、`failed`
- `evaluation_results.status`：`ai_draft`、`teacher_reviewed`、`published`
- `jobs.status`：`queued`、`running`、`succeeded`、`failed`、`cancelled`
- `report_exports.status`：`queued`、`running`、`succeeded`、`failed`

## 4. 关键关系

- 一个课程可以关联多个班级，一个班级也可以承载多门课程。
- 一个实训任务属于一门课程，并绑定一个评价模板版本。
- 一个学生对同一实训任务允许多次提交，但只能有一个当前有效提交。
- 一个提交包含多个成果文件，一个成果文件可以产生多个解析片段。
- 一个提交最多有一个当前评价结果；评价结果包含多条指标得分和核查发现，规则分与 AI 草稿可被重新生成但最终教师分不能被后台覆盖。
- 报表导出记录操作者、筛选条件、生成状态和对象存储 key。
- 后台任务通过 `jobs.run_after`、`locked_at`、`locked_by`、`attempts` 和 `max_attempts` 支持延迟重试、多 worker 并发领取和崩溃恢复。
- 审计日志通过 `action`、`entity_type`、`entity_id` 和 `detail_json` 关联上传、解析、LLM、改分、发布和导出等关键操作。

## 5. 首版查询场景

- 教师按课程/班级查看提交进度和评价状态。
- 学生查看自己的提交状态、解析结果摘要和已发布评价。
- 教师打开单个提交，查看成果文件、解析证据、AI 初评、核查发现并复核。
- 管理端按课程生成班级分布、指标均值、常见问题 Top N 和导出文件。
- 审计端追踪某次教师改分、LLM 调用或报表导出。
- 教师/管理员按任务类型、任务状态、提交 ID 或成果 ID 排查异步任务。
- 教师/管理员按动作、实体或操作者筛选审计日志，定位上传与解析链路问题。
- 教师查看单个提交的 AI 初评草稿、指标分、置信度、核查发现和 LLM 调用留痕。

## 6. 迁移脚本

初版 SQL 位于 `apps/api/migrations/001_initial_schema.sql`。并发任务索引位于 `apps/api/migrations/002_job_queue_concurrency.sql`。审计与任务状态查询索引位于 `apps/api/migrations/003_audit_and_job_status_indexes.sql`。评价 worker、LLM 调用和核查发现查询索引位于 `apps/api/migrations/004_evaluation_worker_indexes.sql`。迁移脚本只定义数据库结构，不写入演示数据；演示数据后续放在 `fixtures/demo-data`。
