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

如果只想看页面和基础管理功能，未配置 LLM 也能启动；系统会把评价降级到教师复核草稿。

## 5. 从 Release Artifact 部署

如果使用 GitHub Actions 产物，解压后建议目录结构保持：

```text
/opt/loongarch-b1
  api/
  web/
  docs/
  scripts/
  .env
```

当前 `start-stack.sh` 会自动识别两种布局：

- 源码布局：`apps/api/dist` + `apps/web/dist`
- Release 布局：`api/dist` + `web/`

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
