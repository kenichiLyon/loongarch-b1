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
- 新增依赖前必须确认是否包含 native binary；如包含，需在 `docs/LOONGARCH_COMPATIBILITY.md` 记录验证计划。
- 核心业务链路优先选择纯 TypeScript/JavaScript 或可在通用 Linux 编译的依赖。

## 新增依赖流程

1. 说明依赖用途和替代方案。
2. 使用 `pnpm add --save-exact` 或 `pnpm add -D --save-exact`。
3. 运行 `pnpm install --lockfile-only` 更新 lockfile。
4. 运行 `pnpm --filter @loongarch-b1/api test` 和 `pnpm build`。
5. 通过 GitHub MCP 提交 `package.json`、`pnpm-lock.yaml` 和相关代码/文档。

## 禁止事项

- 禁止提交真实 `.env`、API Key、Token 或数据库密码。
- 禁止在未评估 LoongArch 风险的情况下引入核心 native 依赖。
- 禁止只修改 `package.json` 而不更新 lockfile。
