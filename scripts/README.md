# 脚本目录

本目录用于存放开发、检查、部署相关辅助脚本。

脚本必须满足：

- 不包含密钥或真实环境敏感信息。
- 默认在 Windows PowerShell 和 Linux Shell 场景下给出明确说明。
- 对会修改数据或环境的操作提供显式提示或 dry-run 选项。

## 当前脚本

- `loongarch-dependency-risk.mjs`：扫描 `pnpm-lock.yaml` 中的 LoongArch/银河麒麟依赖风险，执行 `pnpm risk:loongarch` 会生成 `docs/LOONGARCH_DEPENDENCY_RISK.md`。
- `loongarch-dependency-risk.test.mjs`：使用 Node.js 内置 test runner 验证 lockfile 解析、风险分级和 Markdown 报告渲染，可通过 `pnpm test:scripts` 执行。
- `deploy/kylin-loongarch/start-stack.sh`：在目标系统上一条命令启动数据库迁移、API 和合并 worker。
- `deploy/kylin-loongarch/stop-stack.sh`：停止一键启动脚本拉起的 API 和 worker 进程。
- `deploy/kylin-loongarch/status-stack.sh`：查看一键启动脚本拉起的进程状态。
- `deploy/kylin-loongarch/systemd/*.service`：银河麒麟 systemd 部署模板。
