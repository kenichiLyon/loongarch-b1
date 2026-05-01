# loongarch-b1

基于大模型技术的软件实训教学结果检查评价与报表系统，面向软件实训课程的成果上传、智能核查、多维评分、教师复核和报表导出。

## 项目目标

- 支持学生上传 Word、PDF、报告、截图、代码包或 Git 链接等实训成果。
- 通过确定性解析、规则核查和大模型初评提取核心信息、识别步骤缺失和逻辑风险。
- 支持教师配置评价指标与权重，并在 AI 初评基础上进行主观复核和最终确认。
- 生成学生个人评价报告、班级/课程统计报表，并支持 Excel/PDF 导出。
- 固定适配 LoongArch 架构 + 银河麒麟高级服务器版，兼顾 amd64 Windows/Linux 开发调试。

## 首版技术栈

- 前端：Vue 3、Vite、TypeScript、Element Plus、ECharts。
- 后端：NestJS、TypeScript、PostgreSQL。
- 文件存储：本地对象存储抽象，预留 MinIO/S3 兼容扩展。
- 大模型：OpenAI-compatible LLM Gateway，支持云端和本地/局域网模型服务。
- 部署：systemd 非容器部署 + Docker/Podman 容器部署说明。

## 仓库结构

```text
apps/
  api/      NestJS 后端服务
  web/      Vue 3 前端应用
docs/       需求、架构、路线图、国产化适配和安全文档
fixtures/   可重复测试样例和演示数据说明
scripts/    本地开发、检查、部署辅助脚本
```

## 开发纪律

所有开发者和 agent 必须先阅读 `AGENT.md`。任何会修改仓库内容的操作都必须通过 GitHub MCP 提交到远端仓库，禁止只在本地修改。

## 当前阶段

当前处于第 0 周：项目治理与仓库初始化。下一步进入工程骨架初始化和 LoongArch 依赖风险前置验证。
