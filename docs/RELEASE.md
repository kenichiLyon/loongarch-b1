# 发布与自动构建产物

本项目使用 GitHub Actions CD 工作流自动生成 build artifacts。该流程用于阶段演示、测试部署和后续 LoongArch + 银河麒麟交付包制作。

## 触发方式

- 推送到 `main`：生成 auto build artifact，保留 30 天。
- 手动触发 `workflow_dispatch`：生成一次 auto build artifact。
- 推送 `v*` tag：生成 auto build artifact，并发布 GitHub Release。

## 产物内容

CD 工作流会生成 `release/` 目录并上传为 artifact：

- `web/`：前端 Vite 构建产物，可由 Nginx 或静态服务托管。
- `api/`：后端 `dist/`、API package.json、数据库迁移 SQL。
- `docs/`：README、AGENT、部署与开发文档。
- `bundles/loongarch-b1-web-<sha>.tar.gz`：前端压缩包。
- `bundles/loongarch-b1-api-<sha>.tar.gz`：后端压缩包。
- `bundles/loongarch-b1-docs-<sha>.tar.gz`：文档与清单压缩包。
- `BUILD_MANIFEST.json`：构建时间、commit、ref、Node/pnpm 版本、目标平台和产物列表。

## 自动检查

- CI 和 CD 在测试、构建前均执行 `pnpm lint`，当前使用 ESLint flat config 覆盖 TypeScript 与 Vue 文件。
- CI/CD 包含 Sourcery AI code review/release review job；在 GitHub 仓库 Secrets 中配置 `SOURCERY_TOKEN` 后，PR、分支推送和发布打包会自动触发 Sourcery 审核。
- 未配置 `SOURCERY_TOKEN` 时，Sourcery job 会显式跳过，不阻塞普通构建。

## 发布版本

创建版本 tag 后会自动发布 GitHub Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

Release 资产包含 web/api/docs 三个压缩包和 `BUILD_MANIFEST.json`。

## 目标环境落地说明

- Web 产物是静态文件，后续部署到 Nginx 或后端静态服务。
- API 产物不包含 `node_modules`，目标环境需按 `pnpm-lock.yaml` 安装生产依赖或使用后续容器镜像。
- 数据库迁移 SQL 随 API 产物一起发布，部署时执行 `pnpm db:migrate`。
- 解析 worker 使用同一 API 产物启动，命令为 `pnpm worker:parse`；生产环境可通过 systemd 启动多个 worker 实例。
- LoongArch 上仍需按 `docs/LOONGARCH_COMPATIBILITY.md` 验证 Node.js、pnpm、PostgreSQL 和 native optional 依赖。
