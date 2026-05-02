# 数据库迁移

后端提供轻量级 SQL 迁移执行器，避免在首版引入复杂 ORM 或 native 风险较高的数据库工具。

## 使用方式

1. 确认 `.env` 中配置了 `DATABASE_URL`。
2. 确认 PostgreSQL 已创建目标数据库。
3. 执行：

```bash
pnpm db:migrate
```

## 迁移规则

- 迁移文件位于 `apps/api/migrations`。
- 文件名格式为 `001_name.sql`、`002_name.sql`。
- 系统按版本号升序执行。
- 已执行迁移记录在 `schema_migrations`。
- 如果已执行迁移的 checksum 发生变化，迁移器会拒绝继续执行。
- 每个迁移文件在单独事务中执行；失败会回滚当前迁移。

## 设计原因

- SQL 文件可直接在 LoongArch + 银河麒麟目标环境审计和执行。
- 不依赖 Prisma 等可能带来平台 binary 兼容风险的工具。
- 适合当前 MVP 阶段的 PostgreSQL-first 架构。

## 当前迁移

- `001_initial_schema.sql`：创建用户、课程、提交、成果、评价、报表、任务和审计等核心表。
- `002_job_queue_concurrency.sql`：补充任务领取、stale running job 释放和 artifact 状态查询所需索引，支撑多 worker 并发消费。
- `003_audit_and_job_status_indexes.sql`：补充任务状态查询、payload 中 submission/artifact 定位和审计日志筛选索引，支撑教师端高并发排障。
