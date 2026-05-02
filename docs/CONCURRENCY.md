# 高并发与异步任务策略

本系统面向班级/课程批量提交场景，上传、解析、评价和导出必须避免同步阻塞主请求链路。

## 当前已落地

- 上传接口使用 Multer 磁盘临时文件，不把完整文件长期保存在 Node.js 内存中。
- 文件保存到 `STORAGE_ROOT` 后，只在数据库中记录 `storage_key`、hash、大小和状态。
- 上传完成后创建 `jobs` 表任务，解析由独立 worker 消费，API 请求只负责入队。
- 任务领取使用 PostgreSQL `FOR UPDATE SKIP LOCKED`，多个 worker 并发运行时不会领取同一条任务。
- worker 每次按 `JOB_BATCH_SIZE` 批量领取任务，失败后按 `JOB_RETRY_DELAY_SECONDS` 延迟重试，超过 `max_attempts` 后标记失败。
- `JOB_STALE_AFTER_SECONDS` 用于释放崩溃 worker 遗留的 `running` 任务，避免永久卡死。
- 文本解析通过 `PARSER_MAX_TEXT_CHARS` 截断，避免超大文本拖垮单个 worker。

## 数据库并发要点

- `idx_jobs_claim_queue`：优化 `job_type + status + run_after + created_at` 的任务领取查询。
- `idx_jobs_running_locked`：优化 stale running job 释放。
- `idx_artifacts_status_submission`：优化提交物状态聚合和提交状态推进。
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

## 后续增强

- 上传链路增加速率限制和租户/课程级配额。
- 解析 worker 拆分为 Word/PDF/OCR/代码包不同队列，避免重任务阻塞轻任务。
- 对本地对象存储增加孤儿文件清理任务。
- 增加 Prometheus 指标：队列长度、任务耗时、失败率、重试次数、worker 心跳。
