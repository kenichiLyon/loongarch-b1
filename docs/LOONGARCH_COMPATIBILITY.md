# LoongArch 与银河麒麟兼容性清单

## 目标环境

- CPU 架构：LoongArch。
- 操作系统：银河麒麟高级服务器版。
- 部署方式：systemd 非容器部署 + Docker/Podman 容器部署方案。

## 前置验证项

- Node.js LTS 在 LoongArch 上的安装方式：系统软件源、龙芯软件源或源码编译。
- PostgreSQL 安装、初始化、备份与恢复。
- 前端静态资源构建产物在 Nginx 或后端静态服务中的运行情况。
- PDF/Word/Excel 解析和导出相关依赖是否包含 native binary。
- 每次新增依赖后执行 `pnpm risk:loongarch`，并将 `docs/LOONGARCH_DEPENDENCY_RISK.md` 纳入 PR 审查。
- PDF 中文字体路径、字体授权和嵌入效果。
- OCR/Office 转换等可选能力是否可用，以及不可用时的降级路径。
- Docker/Podman 基础镜像是否支持 LoongArch。

## 依赖选择原则

- 优先选择纯 TypeScript/JavaScript 或通用 Linux 可编译依赖。
- 避免把未验证 native binary 依赖放入核心链路。
- 对可能失败的平台能力提供状态标记、错误信息和人工处理入口。

## 验证记录

### 2026-05-02：RBAC 鉴权实现

- 变更：登录、首个管理员初始化、Bearer Token 签名校验和角色守卫。
- 依赖：仅使用 Node.js 内置 `crypto` 的 `scrypt` 与 HMAC-SHA256，未新增第三方 native 依赖。
- 影响：LoongArch 目标环境只需验证 Node.js 22+ 内置加密模块可用；无需额外系统库。

### 2026-05-02：Lint、Sourcery 与上传链路

- 变更：新增 ESLint、Sourcery AI CI job、Multer 内存上传、本地 ObjectStore 和 artifacts 入库。
- 依赖：ESLint 生态、`multer`、`@types/multer` 均为 JavaScript/TypeScript 依赖，未引入核心 native binary。
- 影响：LoongArch 部署需验证 `STORAGE_ROOT` 目录权限、磁盘容量、文件名编码和 Node.js `crypto` SHA-256 计算；GitHub Actions 上的 Sourcery 仅用于远端自动审核，不属于目标服务器运行时依赖。

### 2026-05-02：解析 worker 与高并发 jobs 队列

- 变更：新增 `pnpm worker:parse`、PostgreSQL `FOR UPDATE SKIP LOCKED` 任务领取、失败重试、stale running job 释放和解析内容入库。
- 依赖：仅使用 Node.js 内置文件系统/crypto 与 PostgreSQL 行锁能力，未新增第三方运行时依赖。
- 影响：目标环境需验证 PostgreSQL 版本支持 `SKIP LOCKED`，并按 worker 数量调整 `DATABASE_POOL_MAX`、PostgreSQL `max_connections` 和 `STORAGE_ROOT` IO 能力。

### 2026-05-02：LoongArch 依赖风险扫描

- 变更：新增 `pnpm risk:loongarch`，从 `pnpm-lock.yaml` 扫描 CPU/OS 过滤、构建脚本、CLI binary、optional dependency 和常见 native 包族，生成 `docs/LOONGARCH_DEPENDENCY_RISK.md`。
- 依赖：扫描脚本仅使用 Node.js 内置模块，未新增运行时或开发依赖。
- 当前结果：381 个包，0 个高风险、30 个中风险、64 个低风险；中风险主要为 Linux 平台限定的 esbuild/rollup optional 包和构建 CLI。
- 影响：目标环境仍需执行 `pnpm install --frozen-lockfile`、`pnpm build`、`pnpm --filter @loongarch-b1/api test`，确认 linux-loong64 optional 包安装路径和构建行为。

### 2026-05-02：审计日志与任务状态查询

- 变更：上传与解析 worker 写入 `audit_logs`，管理员/教师可通过 `GET /jobs`、`GET /audit-logs` 排查异步任务状态和处理留痕。
- 依赖：仅复用 PostgreSQL 表、JSONB 字段和 B-tree/表达式索引，未新增第三方依赖。
- 影响：高并发上传时审计写入与业务事务一致；目标环境需观察 `audit_logs` 增长量并按课程周期制定归档策略。

### 2026-05-02：LLM Gateway 与评价 worker

- 变更：新增 OpenAI-compatible LLM Gateway、脱敏证据摘要、JSON 初评校验、`evaluate_submission` worker、AI 草稿落库和评价查询接口。
- 依赖：仅使用 Node.js 22 内置 `fetch`、`AbortController`、`crypto` 与 PostgreSQL JSONB，未新增第三方运行时依赖。
- 影响：目标环境需验证 Node.js 22 内置 fetch 可用；本地/局域网模型服务需提供 `/chat/completions` 兼容接口。若未配置 `LLM_BASE_URL`/`LLM_MODEL`，系统会降级生成教师复核草稿，不阻塞上传和解析主流程。

### 2026-05-03：报表统计与导出 worker

- 变更：新增 `GET /reports/statistics`、报表导出 API、`pnpm worker:export`、最小 `.xlsx` OpenXML 生成和纯文本 PDF 生成，并将导出文件写入本地对象存储。
- 依赖：未新增第三方依赖；Excel/PDF 基础生成仅使用 Node.js `Buffer`、文件系统和 PostgreSQL 查询。
- 影响：LoongArch 目标环境需验证大批量已发布评价统计查询耗时、`STORAGE_ROOT/report-exports` 写入权限和磁盘容量。当前 PDF 为纯文本基础实现，中文字体嵌入、图表渲染和复杂版式需在银河麒麟目标环境补充字体路径与授权验证。

后续每次发现平台差异时，在本文件追加：验证日期、目标环境版本、依赖版本、测试命令、结果和替代方案。
