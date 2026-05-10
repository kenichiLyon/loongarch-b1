# loongarch-b1

基于大模型技术的软件实训教学结果检查评价与报表系统。项目面向高校/职教软件实训，提供成果提交、自动解析、智能核查、多维评价、教师复核、统计报表和 LoongArch + 银河麒麟部署支持。

## 1. MVP 范围

- PC Web 可视化界面。
- 管理员、教师、学生三类角色。
- 课程、班级、实训任务、评价模板与指标权重。
- Word、PDF、报告、截图、代码包、Git 链接等成果入口。
- 文件解析、规则核查、LLM 初评、教师复核、结果发布。
- 学生个人反馈、班级/课程统计报表、Excel/PDF 导出。
- LoongArch + 银河麒麟高级服务器版部署适配。

## 2. 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3 + Vite + TypeScript |
| UI / 图表 | Element Plus + ECharts |
| 后端 | NestJS + TypeScript |
| 数据库 | PostgreSQL |
| 文件存储 | Local ObjectStore |
| 大模型 | OpenAI-compatible HTTP API |
| 部署 | runtime CLI package + systemd；Docker/Podman 次级 |

## 3. 仓库结构

```text
apps/
  api/      NestJS 后端服务
  web/      Vue 3 前端应用
docs/       架构、部署、发布、兼容性等详细文档
scripts/    开发、检查、部署辅助脚本
AGENT.md    固定开发流程
```

## 4. 快速开始

### 环境要求

- Node.js: `>=22 <25`
- pnpm: `>=10`
- PostgreSQL: 15+
- 开发环境: amd64 Windows/Linux
- 目标环境: LoongArch + 银河麒麟高级服务器版

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env
```

### 本地开发

```bash
pnpm dev
```

### 构建与检查

```bash
pnpm check
pnpm test
pnpm risk:loongarch
```

## 5. 运行与交付

### 主交付运行时包

```bash
pnpm build
pnpm bundle:runtime
```

输出目录：

```text
release/runtime
release/bundles/loongarch-b1-runtime-npm-<shortsha>.tgz
```

runtime 包里带 CLI：

```bash
./loongarch-b1 start
./loongarch-b1 worker:all
./loongarch-b1 db:migrate
```

如果已全局安装 runtime-npm 包：

```bash
npm install -g ./release/bundles/loongarch-b1-runtime-npm-<shortsha>.tgz
loongarch-b1 start
```

### 次级交付

- `docs/DEPLOY_KYLIN_LOONGARCH.md`：目标系统部署手册。
- `docs/RELEASE.md`：自动构建与发布物说明。
- `Dockerfile` / `compose.yaml`：Docker/Podman 次级方案。

## 6. 详细文档

见 [docs/INDEX.md](docs/INDEX.md)。

## 7. 当前状态

- 主链路已完成：提交、解析、核查、评价、复核、发布、报表导出。
- 交付形态已完成：runtime CLI 包、runtime-npm 包、Docker 次级交付。
- 下一步重点：目标机实测、复杂文档解析增强、上下文工程和报表增强。
