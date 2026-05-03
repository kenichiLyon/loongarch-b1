# LoongArch 依赖风险扫描报告

生成时间：2026-05-03T05:03:08.139Z

## 摘要

- 扫描包数量：381
- 高风险：0
- 中风险：30
- 低风险：64

## 风险列表

| 等级 | 包 | 触发原因 | 建议 |
| --- | --- | --- | --- |
| medium | `@esbuild/linux-arm@0.25.12` | cpu filter: arm; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-arm@0.27.7` | cpu filter: arm; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-arm64@0.25.12` | cpu filter: arm64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-arm64@0.27.7` | cpu filter: arm64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-ia32@0.25.12` | cpu filter: ia32; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-ia32@0.27.7` | cpu filter: ia32; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-mips64el@0.25.12` | cpu filter: mips64el; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-mips64el@0.27.7` | cpu filter: mips64el; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-ppc64@0.25.12` | cpu filter: ppc64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-ppc64@0.27.7` | cpu filter: ppc64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-riscv64@0.25.12` | cpu filter: riscv64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-riscv64@0.27.7` | cpu filter: riscv64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-s390x@0.25.12` | cpu filter: s390x; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-s390x@0.27.7` | cpu filter: s390x; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-x64@0.25.12` | cpu filter: x64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@esbuild/linux-x64@0.27.7` | cpu filter: x64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-arm-gnueabihf@4.60.2` | cpu filter: arm; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-arm-musleabihf@4.60.2` | cpu filter: arm; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-arm64-gnu@4.60.2` | cpu filter: arm64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-arm64-musl@4.60.2` | cpu filter: arm64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-ppc64-gnu@4.60.2` | cpu filter: ppc64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-ppc64-musl@4.60.2` | cpu filter: ppc64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-riscv64-gnu@4.60.2` | cpu filter: riscv64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-riscv64-musl@4.60.2` | cpu filter: riscv64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-s390x-gnu@4.60.2` | cpu filter: s390x; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-x64-gnu@4.60.2` | cpu filter: x64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `@rollup/rollup-linux-x64-musl@4.60.2` | cpu filter: x64; os filter: linux; known native or platform-sensitive package family | 平台限定依赖；确认是否为 optional 包，并验证 linux-loong64 是否有对应实现或可降级。 |
| medium | `esbuild@0.25.12` | ships CLI binary; known native or platform-sensitive package family | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| medium | `esbuild@0.27.7` | ships CLI binary; known native or platform-sensitive package family | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| medium | `rollup@4.60.2` | ships CLI binary; known native or platform-sensitive package family | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `@babel/parser@7.29.3` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `@esbuild/aix-ppc64@0.25.12` | cpu filter: ppc64; os filter: aix; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/aix-ppc64@0.27.7` | cpu filter: ppc64; os filter: aix; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/android-arm@0.25.12` | cpu filter: arm; os filter: android; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/android-arm@0.27.7` | cpu filter: arm; os filter: android; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/android-arm64@0.25.12` | cpu filter: arm64; os filter: android; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/android-arm64@0.27.7` | cpu filter: arm64; os filter: android; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/android-x64@0.25.12` | cpu filter: x64; os filter: android; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/android-x64@0.27.7` | cpu filter: x64; os filter: android; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/darwin-arm64@0.25.12` | cpu filter: arm64; os filter: darwin; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/darwin-arm64@0.27.7` | cpu filter: arm64; os filter: darwin; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/darwin-x64@0.25.12` | cpu filter: x64; os filter: darwin; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/darwin-x64@0.27.7` | cpu filter: x64; os filter: darwin; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/freebsd-arm64@0.25.12` | cpu filter: arm64; os filter: freebsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/freebsd-arm64@0.27.7` | cpu filter: arm64; os filter: freebsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/freebsd-x64@0.25.12` | cpu filter: x64; os filter: freebsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/freebsd-x64@0.27.7` | cpu filter: x64; os filter: freebsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/linux-loong64@0.25.12` | cpu filter: loong64; os filter: linux; known native or platform-sensitive package family | 已出现 LoongArch/loong64 平台条目，目标环境仍需执行 frozen install 和构建验证。 |
| low | `@esbuild/linux-loong64@0.27.7` | cpu filter: loong64; os filter: linux; known native or platform-sensitive package family | 已出现 LoongArch/loong64 平台条目，目标环境仍需执行 frozen install 和构建验证。 |
| low | `@esbuild/netbsd-arm64@0.25.12` | cpu filter: arm64; os filter: netbsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/netbsd-arm64@0.27.7` | cpu filter: arm64; os filter: netbsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/netbsd-x64@0.25.12` | cpu filter: x64; os filter: netbsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/netbsd-x64@0.27.7` | cpu filter: x64; os filter: netbsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/openbsd-arm64@0.25.12` | cpu filter: arm64; os filter: openbsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/openbsd-arm64@0.27.7` | cpu filter: arm64; os filter: openbsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/openbsd-x64@0.25.12` | cpu filter: x64; os filter: openbsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/openbsd-x64@0.27.7` | cpu filter: x64; os filter: openbsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/openharmony-arm64@0.25.12` | cpu filter: arm64; os filter: openharmony; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/openharmony-arm64@0.27.7` | cpu filter: arm64; os filter: openharmony; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/sunos-x64@0.25.12` | cpu filter: x64; os filter: sunos; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/sunos-x64@0.27.7` | cpu filter: x64; os filter: sunos; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/win32-arm64@0.25.12` | cpu filter: arm64; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/win32-arm64@0.27.7` | cpu filter: arm64; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/win32-ia32@0.25.12` | cpu filter: ia32; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/win32-ia32@0.27.7` | cpu filter: ia32; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/win32-x64@0.25.12` | cpu filter: x64; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@esbuild/win32-x64@0.27.7` | cpu filter: x64; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@nuxt/opencollective@0.4.1` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `@rollup/rollup-android-arm-eabi@4.60.2` | cpu filter: arm; os filter: android; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-android-arm64@4.60.2` | cpu filter: arm64; os filter: android; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-darwin-arm64@4.60.2` | cpu filter: arm64; os filter: darwin; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-darwin-x64@4.60.2` | cpu filter: x64; os filter: darwin; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-freebsd-arm64@4.60.2` | cpu filter: arm64; os filter: freebsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-freebsd-x64@4.60.2` | cpu filter: x64; os filter: freebsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-linux-loong64-gnu@4.60.2` | cpu filter: loong64; os filter: linux; known native or platform-sensitive package family | 已出现 LoongArch/loong64 平台条目，目标环境仍需执行 frozen install 和构建验证。 |
| low | `@rollup/rollup-linux-loong64-musl@4.60.2` | cpu filter: loong64; os filter: linux; known native or platform-sensitive package family | 已出现 LoongArch/loong64 平台条目，目标环境仍需执行 frozen install 和构建验证。 |
| low | `@rollup/rollup-openbsd-x64@4.60.2` | cpu filter: x64; os filter: openbsd; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-openharmony-arm64@4.60.2` | cpu filter: arm64; os filter: openharmony; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-win32-arm64-msvc@4.60.2` | cpu filter: arm64; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-win32-ia32-msvc@4.60.2` | cpu filter: ia32; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-win32-x64-gnu@4.60.2` | cpu filter: x64; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `@rollup/rollup-win32-x64-msvc@4.60.2` | cpu filter: x64; os filter: win32; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `acorn@8.16.0` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `cssesc@3.0.0` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `eslint@10.3.0` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `fsevents@2.3.3` | os filter: darwin; known native or platform-sensitive package family | 非目标 OS 平台条目；保留在 lockfile 中即可，重点关注 linux 相关平台包。 |
| low | `he@1.2.0` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `nanoid@3.3.12` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `semver@7.7.4` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `tsx@4.21.0` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `typescript@5.9.3` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `vite@6.4.2` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `vue-tsc@2.2.12` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |
| low | `which@2.0.2` | ships CLI binary | CLI 工具依赖；不进入生产运行链路时风险较低，仍需在目标环境执行构建验证。 |

## 处理原则

- `high`：进入核心运行链路前必须在 LoongArch + 银河麒麟上验证或替换。
- `medium`：通常是构建工具、可选平台包或 CLI，需要在 CI/目标环境构建演练中确认。
- `low`：多为已包含 LoongArch 平台条目或纯 JS CLI，记录即可，随版本升级复查。

本报告由 `pnpm risk:loongarch` 生成。
