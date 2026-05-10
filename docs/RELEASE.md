# 发布与自动构建产物

本项目使用 GitHub Actions CD 工作流自动生成 build artifacts。该流程用于阶段演示、测试部署和后续 LoongArch + 银河麒麟交付包制作。

## 触发方式

- 推送到 `main`：生成 auto build artifact，保留 30 天。
- 推送到 `main`：同时刷新 GitHub prerelease `pre-main`，便于直接下载最新构建包。
- 手动触发 `workflow_dispatch`：生成一次 auto build artifact。
- 推送 `v*` tag：生成 auto build artifact，并发布 GitHub Release。

## 产物内容

CD 工作流会生成 `release/` 目录并上传为 artifact：

- `runtime/`：主交付运行时目录，包含 API 生产依赖、后端构建产物、前端静态文件和部署脚本。
- `runtime/package.json`：部署专用 npm 入口，支持 `npm run start` / `npm run worker:all` / `npm run db:migrate`，并提供 `loongarch-b1` CLI。
- `runtime/loongarch-b1`：直接执行的 CLI 入口。
- `web/`：前端 Vite 构建产物，可由 Nginx 或静态服务托管。
- `api/`：后端 `dist/`、API package.json、数据库迁移 SQL。
- `docs/`：README、AGENT、部署与开发文档。
- `scripts/`：部署与运维脚本，包括银河麒麟 + LoongArch 的一键启动脚本与 systemd 模板。
- `docker-context/`：Docker 次级交付上下文，包含 `Dockerfile`、`compose.yaml` 和构建所需源码。
- `bundles/loongarch-b1-runtime-<sha>.tar.gz`：主交付运行时压缩包。
- `bundles/loongarch-b1-runtime-npm-<sha>.tgz`：可 `npm install -g` 的 runtime 包。
- `bundles/loongarch-b1-web-<sha>.tar.gz`：前端压缩包。
- `bundles/loongarch-b1-api-<sha>.tar.gz`：后端压缩包。
- `bundles/loongarch-b1-docs-<sha>.tar.gz`：文档与清单压缩包。
- `bundles/loongarch-b1-docker-context-<sha>.tar.gz`：Docker 次级交付上下文压缩包。
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

Release 资产现在包含 `runtime/web/api/docs/docker-context` 对应压缩包、`runtime-npm` 包和 `BUILD_MANIFEST.json`；其中 `runtime` 是推荐主交付，`runtime-npm` 是可直接安装的 Node 交付包，`docker-context` 是次级交付。

## 预发布版本

仓库会维护一个固定 prerelease：

- Tag：`pre-main`
- Release 名称：`pre-main`

用途：

- 始终承载 `main` 分支最新一次成功构建的 bundles
- 方便测试部署、试点环境和验收人员直接拿“最新可运行包”
- 不替代正式版本 tag release

更新规则：

- 每次 `main` 分支 CD 成功后，workflow 会用 `--clobber` 替换 prerelease 资产
- 该 prerelease 的 source code tag 不是构建真实性来源
- 真正的构建来源以附件中的 `BUILD_MANIFEST.json` 和 bundles 内内容为准

## 目标环境落地说明

- `runtime` 产物是主交付：目标环境不需要再次执行 `pnpm install`，解压后即可用 `node`、`npm run ...`、`./loongarch-b1 ...` 或 `start-stack.sh` 启动。
- `runtime-npm` 产物可以用 `npm install -g <tgz>` 安装后直接使用 `loongarch-b1 ...` 命令。
- Web 产物仍单独保留，可部署到 Nginx，也可由 API 进程直接托管。
- `api` 产物保留为调试/拆分部署用途，不包含 `node_modules`。
- 数据库迁移 SQL 随 API 产物一起发布，部署时执行 `pnpm db:migrate`。
- 解析、评价、导出 worker 可通过单一命令 `node dist/workers/all-workers.js` 或 `scripts/deploy/kylin-loongarch/start-stack.sh` 启动。
- Docker 作为次级交付：仓库和 `docker-context` 压缩包中都包含 `Dockerfile` 与 `compose.yaml`，CI 会验证 Dockerfile 可构建。
- 目标系统部署步骤见 `docs/DEPLOY_KYLIN_LOONGARCH.md`。
- LoongArch 上仍需按 `docs/LOONGARCH_COMPATIBILITY.md` 验证 Node.js、pnpm、PostgreSQL 和 native optional 依赖。
