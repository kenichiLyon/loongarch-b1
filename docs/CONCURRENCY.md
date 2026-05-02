# 高并发与异步任务策略

本系统面向班级/课程批量提交场景，上传、解析、评价和导出必须避免同步阻塞主请求链路。

## 当前已落地

- 上传接口使用 Multer 磁盘临时文件，不把完整文件长期保存在 Node.js 内存中。
- 文件保存到 `STORAGE_ROOT` 后，只在数据库中记录 `storage_key`、hash、大小和状态。
- 上传完成后创建 `jobs` 表任务，解析由独立 worker 消费，API 请求只负责入队。
- 全部成果解析完成后自动创建 `evaluate_submission` 任务，评价 worker 独立构建脱敏摘要并调用 LLM Gateway，API 请求不等待模型响应。
- 任务领取使用 PostgreSQL `FOR UPDATE SKIP LOCKED`，多个 worker 并发运行时不会领取同一条任务。
- worker 每次按 `JOB_BATCH_SIZE` 批量领取任务，失败后按 `JOB_RETRY_DELAY_SECONDS` 延迟重试，超过 `max_attempts` 后标记失败。
- `JOB_STALE_AFTER_SECONDS` 用于释放崩溃 worker 遗留的 `running` 任务，避免永久卡死。
- 文本解析通过 `PARSER_MAX_TEXT_CHARS` 截断，避免超大文本拖垮单个 worker。
- 上传和解析结果写入审计日志；写入发生在同一数据库事务内，保证排障时可以关联业务状态和操作记录。
- 管理员/教师可通过 `GET /jobs` 查询异步任务，通过 `GET /audit-logs` 查询处理留痕；接口单次最多返回 200 条，避免状态页拖垮数据库。

## 数据库并发要点

- `idx_jobs_claim_queue`：优化 `job_type + status + run_after + created_at` 的任务领取查询。
- `idx_jobs_running_locked`：优化 stale running job 释放。
- `idx_artifacts_status_submission`：优化提交物状态聚合和提交状态推进。
- `idx_jobs_type_status_updated`：优化教师端按任务类型和状态排查队列。
- `idx_jobs_payload_submission`、`idx_jobs_payload_artifact`：优化通过提交或成果定位解析任务。
- `idx_audit_logs_action_created`、`idx_audit_logs_actor_created`：优化审计日志按动作和操作者筛选。
- `idx_llm_call_logs_submission_created`：优化单个提交的 LLM 调用追踪。
- `idx_evaluation_results_status_updated`：优化教师端待复核列表。
- `idx_verification_findings_type_severity`：优化常见问题统计。
- API 连接池由 `DATABASE_POOL_MAX` 控制；部署时应按 CPU、PostgreSQL max_connections 和 worker 数量共同设置。

## 推荐部署方式

- API 服务：多进程或多实例部署，处理登录、基础数据和上传入队。
- Parse worker：独立 systemd 服务，可按机器 CPU/IO 能力启动多个实例。
- PostgreSQL：作为任务协调点，首版不额外引入 Redis/RabbitMQ，减少 LoongArch 部署组件。
- 对象存储：首版本地磁盘，后续可在 `ObjectStore` 抽象下替换为 MinIO/S3。

## 本地运行示例

执行一次批处理，便于调试：

```bash
JOB_RUN_ONCE=true pnpm worker:parse
```

持续消费解析任务：

```bash
JOB_WORKER_ID=parse-worker-1 JOB_BATCH_SIZE=5 pnpm worker:parse
```

执行一次评价批处理：

```bash
JOB_RUN_ONCE=true JOB_WORKER_ID=evaluation-worker-1 pnpm worker:evaluate
```

持续消费评价任务：

```bash
JOB_WORKER_ID=evaluation-worker-1 JOB_BATCH_SIZE=3 pnpm worker:evaluate
```

LLM 调用属于外部 IO，应按模型服务吞吐能力独立设置评价 worker 数量；本地模型部署时建议先小批量验证显存/内存占用，再逐步提高 `JOB_BATCH_SIZE`。

## 后续增强

- 上传链路增加速率限制和租户/课程级配额。
- 解析 worker 拆分为 Word/PDF/OCR/代码包不同队列，避免重任务阻塞轻任务。
- 评价 worker 增加课程/模型级速率限制，避免云端模型限流或本地模型过载。
- 对本地对象存储增加孤儿文件清理任务。
- 增加 Prometheus 指标：队列长度、任务耗时、失败率、重试次数、worker 心跳。
- 对 `audit_logs` 和历史 `jobs` 增加按学期归档/清理策略，防止长期运行后表膨胀。
