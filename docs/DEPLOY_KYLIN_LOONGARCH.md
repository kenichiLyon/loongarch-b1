# 银河麒麟 + LoongArch 简洁部署

本文档面向自主指令系统 LoongArch 架构 + 银河麒麟高级服务器版，目标是把部署收敛成尽量少的命令，不依赖 Nginx、Docker 或额外进程管理器就能先跑起来。

## 1. 目标形态

- API：NestJS
- Web：Vite 构建后的静态文件，由 API 直接托管
- Worker：单独的 `all-workers` 进程，同时消费解析、评价、报表导出任务
- 启动方式：
  - 开发/试点：一条脚本 `bash scripts/deploy/kylin-loongarch/start-stack.sh`
  - 长期运行：两个 systemd service

## 2. 前置条件

目标机器需要：

- Node.js `22.x`
- PostgreSQL `15+`
- `bash`

不要求安装 Nginx。不建议在 LoongArch 上引入额外的二进制打包器来生成“单文件可执行程序”，因为这会增加目标架构兼容性风险；当前采用的是“Node 运行时 + 一条启动脚本”的最小稳定方案。

## 3. 推荐目录

```bash
sudo mkdir -p /opt/loongarch-b1
sudo chown -R "$USER":"$USER" /opt/loongarch-b1
cd /opt/loongarch-b1
```

## 4. 从源码部署

```bash
git clone <your-repo-url> /opt/loongarch-b1
cd /opt/loongarch-b1
pnpm install --frozen-lockfile
pnpm build
cp .env.example .env
```

至少修改：

- `DATABASE_URL`
- `AUTH_TOKEN_SECRET`
- `AUTH_BOOTSTRAP_TOKEN`
- `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`（如果启用云端模型）

可选增强：

- `OCR_TESSERACT_BIN=/usr/bin/tesseract`
- `OCR_LANGUAGE=chi_sim+eng`
- `OCR_TIMEOUT_MS=15000`

如果只想看页面和基础管理功能，未配置 LLM 也能启动；系统会把评价降级到教师复核草稿。

## 5. 从 Release Artifact 部署

推荐优先使用 `loongarch-b1-runtime-<sha>.tar.gz`。

解压后建议目录结构保持：

```text
/opt/loongarch-b1
  package.json
  loongarch-b1
  api/
  web/
  scripts/
  DEPLOY_KYLIN_LOONGARCH.md
  .env
```

当前 `start-stack.sh` 会自动识别两种布局：

- 源码布局：`apps/api/dist` + `apps/web/dist`
- Release 布局：`api/dist` + `web/`

运行时压缩包里还会带一个部署专用 `package.json`，用于兼容 `npm run ...` 的常见使用方式。
运行时压缩包还会带一个 `loongarch-b1` 可执行入口，解压后即可直接调用单命令。
如果需要标准 npm 安装，`runtime-npm` 包可以直接 `npm install -g` 后得到 `loongarch-b1` 命令。

如果只拿到 `runtime` 压缩包，直接解压即可：

```bash
tar -xzf loongarch-b1-runtime-<sha>.tar.gz -C /opt/loongarch-b1
cp /opt/loongarch-b1/.env.example /opt/loongarch-b1/.env
```

解压后如果直接在目录里执行：

```bash
./loongarch-b1 start
./loongarch-b1 worker:all
./loongarch-b1 db:migrate
```

如果安装到全局 PATH：

```bash
npm install -g ./loongarch-b1-runtime-npm-<sha>.tgz
loongarch-b1 start
```

## 6. 一条命令启动

先构建并准备 `.env` 后，直接执行：

```bash
bash scripts/deploy/kylin-loongarch/start-stack.sh
```

脚本会自动执行：

1. 数据库迁移
2. 启动 API
3. 启动合并 worker 进程

启动后默认访问：

- Web：`http://127.0.0.1:3000/`
- 健康检查：`http://127.0.0.1:3000/health`

查看状态：

```bash
bash scripts/deploy/kylin-loongarch/status-stack.sh
```

停止：

```bash
bash scripts/deploy/kylin-loongarch/stop-stack.sh
```

## 6.1 npm 方式启动

如果部署方更习惯 `npm`，runtime 包解压后也支持：

```bash
npm run db:migrate
npm run start
```

后台 worker：

```bash
npm run worker:all
```

脚本说明：

- `npm run start`：启动 API，并托管 `web/`
- `npm run worker:all`：启动解析、评价、导出合并 worker
- `npm run db:migrate`：执行数据库迁移
- `npm run start:stack`：等价于 `bash scripts/deploy/kylin-loongarch/start-stack.sh`

如果部署方已经把 runtime 包安装到全局 PATH，也可以直接：

```bash
loongarch-b1 start
loongarch-b1 worker:all
loongarch-b1 db:migrate
```

如果使用发布物里的 `runtime-npm` 包：

```bash
npm install -g ./loongarch-b1-runtime-npm-<sha>.tgz
loongarch-b1 start
```

## 7. 运行日志

默认日志目录：

```text
runtime/logs/api.log
runtime/logs/workers.log
```

默认 PID 目录：

```text
runtime/pids/
```

## 8. 环境变量建议

可以直接复用根目录 `.env`，也可以参考：

`scripts/deploy/kylin-loongarch/loongarch-b1.env.example`

关键项：

- `API_PORT`
- `DATABASE_URL`
- `AUTH_TOKEN_SECRET`
- `AUTH_BOOTSTRAP_TOKEN`
- `STORAGE_ROOT`
- `WEB_DIST_DIR`
- `OCR_TESSERACT_BIN`
- `OCR_LANGUAGE`
- `OCR_TIMEOUT_MS`
- `PARSE_JOB_BATCH_SIZE`
- `EVALUATE_JOB_BATCH_SIZE`
- `EXPORT_JOB_BATCH_SIZE`

## 9. systemd 方式

如果要改成开机自启，复制模板：

```bash
sudo cp scripts/deploy/kylin-loongarch/systemd/loongarch-b1-api.service /etc/systemd/system/
sudo cp scripts/deploy/kylin-loongarch/systemd/loongarch-b1-workers.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now loongarch-b1-api.service
sudo systemctl enable --now loongarch-b1-workers.service
```

模板里默认工作目录是：

```text
/opt/loongarch-b1
```

如果实际部署目录不同，先改 service 文件里的 `WorkingDirectory`、`EnvironmentFile` 和 `ExecStart`。

## 10. 首次验收检查

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/health/database
```

然后在浏览器打开 `http://127.0.0.1:3000/`。

首次空库初始化管理员：

```bash
curl -X POST http://127.0.0.1:3000/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"bootstrapToken":"<AUTH_BOOTSTRAP_TOKEN>","username":"admin","displayName":"管理员","initialPassword":"password-123"}'
```

## 11. 当前约束

- 这不是单文件二进制发布，仍然依赖目标机安装 Node.js 22。
- Web 由 API 直接托管，适合试点和中小规模部署；后续如果接入独立 Nginx 或网关，可以再拆分。
- OCR、Office 转换、PDF 中文字体嵌入仍需按目标机字体和系统库补充验证。

## 12. 建议

试点阶段优先使用 `start-stack.sh`，因为它最接近“解压后执行一条命令直接启动”。

正式长期运行再切 systemd，两者共用同一套构建产物和环境变量，不会产生两套部署逻辑。

## 13. 是否需要二进制构建

当前结论：`不需要作为首版交付项`。

原因：

- Node.js 运行时 + 构建产物 + 一条启动脚本，已经满足“尽可能简洁部署”。
- 面向 LoongArch 的单文件二进制方案通常依赖额外打包器或运行时快照机制，平台兼容性和排障成本都更高。
- 本项目本身包含数据库迁移、静态资源、后台 worker，多进程形态天然不适合强行压成单二进制。

什么时候再做：

- 只有在目标单位明确要求“无 Node 运行时依赖、单文件发放”时，才值得评估二进制打包。
- 即便评估，也应放在目标机验证之后，而不是现在替代现有部署方案。

## 14. 是否需要 Docker / Podman 镜像构建

当前结论：`建议做，但不应取代当前 systemd 方案作为主交付`。

原因：

- 目标系统已经固定为银河麒麟 + LoongArch，主交付应优先保证宿主机直接部署可用。
- 容器镜像对 CI 一致性、测试环境复制和后续扩展有价值，但前提是基础镜像、Podman/Docker、卷挂载和 PostgreSQL 连接策略都在目标机上验证通过。
- LoongArch 可用的 Node 基础镜像并不一定像 amd64/arm64 那样成熟，容器方案存在额外验证成本。

建议策略：

- 当前保留 `systemd + start-stack.sh` 作为主部署路径。
- 已补 `Dockerfile` 和 `compose.yaml`，定位为“可选部署方案”。
- 优先使用运行时压缩包和 `node`/`bash` 启动；只有在环境已经具备稳定容器基础镜像时，再切换到 Docker/Podman。

## 15. Docker 次级交付

仓库根目录现在包含：

- `Dockerfile`
- `compose.yaml`
- `.dockerignore`

适用场景：

- amd64/arm64 开发测试
- 统一 CI 验证
- 后续在目标机确认可用基础镜像后，作为可选运行方式

本机或 CI 构建命令：

```bash
docker build --target runtime -t loongarch-b1:local .
```

compose 试跑：

```bash
docker compose up --build
```

注意：

- 当前 `compose.yaml` 默认使用 `postgres:16-bookworm` 和 `node:22` 官方镜像，主要用于次级交付和常见平台验证。
- 如果要在 LoongArch 目标机使用容器方式，需先把 `POSTGRES_IMAGE`、`NODE_BUILD_IMAGE`、`NODE_RUNTIME_IMAGE` 切到实际可用的 LoongArch 基础镜像。
