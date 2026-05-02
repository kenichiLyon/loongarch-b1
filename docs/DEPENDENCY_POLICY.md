# 依赖锁定策略

本项目面向 amd64 Windows/Linux 开发环境和 LoongArch + 银河麒麟目标环境，依赖管理必须同时满足可复现、可审计和可迁移。

## 固定策略

- 使用 pnpm workspace 管理前后端依赖。
- 根目录 `packageManager` 固定为 `pnpm@10.33.2`。
- 直接依赖使用精确版本号，不使用 `^` 或 `~`。
- `pnpm-lock.yaml` 必须提交仓库，用于锁定所有传递依赖。
- CI 使用 `pnpm install --frozen-lockfile`，防止未提交 lockfile 的依赖漂移。
- `.npmrc` 启用 `engine-strict=true` 和 `save-exact=true`。

## LoongArch 注意事项

- 允许构建脚本仅限当前必要依赖：`esbuild` 和 `@nestjs/core`。
- `esbuild`、`rollup` 等工具链包含平台相关 optional 包，lockfile 中应保留 linux-loong64 条目。
- 根目录提供 `pnpm risk:loongarch`，自动扫描 `pnpm-lock.yaml` 中的 CPU/OS 过滤、构建脚本、CLI binary、optional dependency 和常见 native 包族，并生成 `docs/LOONGARCH_DEPENDENCY_RISK.md`。
- 新增依赖前必须确认是否包含 native binary；如包含，需在 `docs/LOONGARCH_COMPATIBILITY.md` 记录验证计划。
- 核心业务链路优先选择纯 TypeScript/JavaScript 或可在通用 Linux 编译的依赖。
- ESLint、Sourcery CI 配置、Multer 上传链路均不依赖额外 native binary；上传实现使用 Node.js 文件系统与内置加密模块。

## 新增依赖流程

1. 说明依赖用途和替代方案。
2. 使用 `pnpm add --save-exact` 或 `pnpm add -D --save-exact`。
3. 运行 `pnpm install --lockfile-only` 更新 lockfile。
4. 运行 `pnpm risk:loongarch` 并检查报告中是否出现新的高风险或核心链路中风险。
5. 运行 `pnpm --filter @loongarch-b1/api test` 和 `pnpm build`。
6. 通过 GitHub MCP 提交 `package.json`、`pnpm-lock.yaml`、`docs/LOONGARCH_DEPENDENCY_RISK.md` 和相关代码/文档。

## 风险分级处理

- `high`：核心运行链路依赖存在目标平台不明确或不支持风险，必须在 LoongArch + 银河麒麟上验证或替换后才能合并。
- `medium`：Linux 平台限定、构建脚本、native/CLI 工具链等依赖，PR 中必须说明是否仅用于构建、是否有 LoongArch 平台条目和目标环境验证计划。
- `low`：非目标 OS 平台包、已包含 linux-loong64 的 optional 包或纯 JS CLI，保留记录并随版本升级复查。

## 禁止事项

- 禁止提交真实 `.env`、API Key、Token 或数据库密码。
- 禁止在未评估 LoongArch 风险的情况下引入核心 native 依赖。
- 禁止只修改 `package.json` 而不更新 lockfile。
- 禁止依赖扫描出现新增高风险后仅更新报告而不记录处置方案。
