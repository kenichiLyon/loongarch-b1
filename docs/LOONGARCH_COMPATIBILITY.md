# LoongArch 与银河麒麟兼容性清单

## 目标环境

- CPU 架构：LoongArch。
- 操作系统：银河麒麟高级服务器版。
- 部署方式：systemd 非容器部署 + Docker/Podman 容器部署方案。

## 前置验证项

- Node.js LTS 在 LoongArch 上的安装方式：系统软件源、龙芯软件源或源码编译。
- PostgreSQL 安装、初始化、备份与恢复。
- 前端静态资源构建产物在 Nginx 或后端静态服务中的运行情况。
- PDF/Word/Excel 解析和导出相关依赖是否包含 native binary。
- PDF 中文字体路径、字体授权和嵌入效果。
- OCR/Office 转换等可选能力是否可用，以及不可用时的降级路径。
- Docker/Podman 基础镜像是否支持 LoongArch。

## 依赖选择原则

- 优先选择纯 TypeScript/JavaScript 或通用 Linux 可编译依赖。
- 避免把未验证 native binary 依赖放入核心链路。
- 对可能失败的平台能力提供状态标记、错误信息和人工处理入口。

## 验证记录

### 2026-05-02：RBAC 鉴权实现

- 变更：登录、首个管理员初始化、Bearer Token 签名校验和角色守卫。
- 依赖：仅使用 Node.js 内置 `crypto` 的 `scrypt` 与 HMAC-SHA256，未新增第三方 native 依赖。
- 影响：LoongArch 目标环境只需验证 Node.js 22+ 内置加密模块可用；无需额外系统库。

后续每次发现平台差异时，在本文件追加：验证日期、目标环境版本、依赖版本、测试命令、结果和替代方案。
