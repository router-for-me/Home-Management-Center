# Home Management Center

[English](README.md) | 中文

Home Management Center 是面向 [CLIProxyAPIHome](https://github.com/router-for-me/CLIProxyAPIHome) 的配套 Web 管理控制台。CLIProxyAPIHome 是用于 CLIProxyAPI 的凭证管理、调度与分发服务；本项目为其提供专业的浏览器控制台，覆盖服务总览、模型服务、账号凭证、客户端访问密钥、用量日志、系统配置和诊断信息等管理能力。

## 功能特性

- **仪表盘**：服务总览、就绪状态、模型服务覆盖、凭证状态、客户端密钥状态和建议操作。
- **模型服务**：管理供应商密钥、检查已配置的模型服务、查看模型参考信息，并支持新建、编辑和删除模型服务条目。
- **账号凭证**：管理 OAuth 和文件凭证、上传凭证 JSON、导入 Vertex 凭证、编辑元数据、查询可用模型、启用、禁用、下载和删除凭证。
- **客户端访问密钥**：管理下游客户端使用的访问密钥，支持新建、编辑、替换、删除、复制、掩码展示和批量选择。
- **用量与日志**：查看 API key 用量、用量队列、运行日志、请求错误日志、文件下载和受保护的清空操作。
- **系统配置**：通过可视化工作台编辑常用配置，或在配置文件模式中使用 diff 预览、校验、重新加载、保存和完整覆盖提醒。
- **系统信息**：查看运行时版本、节点状态、配置摘要、诊断状态和受保护的 API 调用工具。
- **主题系统**：支持浅色和深色模式。

## 国际化

界面当前支持四种语言：

- 简体中文
- 繁体中文
- 英文
- 俄语

界面语言可以根据浏览器设置自动切换，也可以在登录页或顶部语言菜单中手动切换。

## 浏览器兼容性

Home Management Center 面向现代浏览器，并以 `ES2020` 作为构建目标：

- Chrome / Chromium
- Edge
- Firefox
- Safari

界面支持桌面端、平板和移动端的响应式布局。建议使用浏览器的最新稳定版本，旧版浏览器不在支持范围内。

## 环境要求

- Node.js 24 或更新版本
- Bun 1.3 或更新版本
- 一个正在运行的 [CLIProxyAPIHome](https://github.com/router-for-me/CLIProxyAPIHome) 后端，用于提供真实管理数据

## 快速开始

安装依赖：

```bash
bun install
```

启动开发服务：

```bash
bun run dev
```

打开：

```txt
http://localhost:3000
```

## 开发

```bash
bun run dev              # 启动 Rsbuild 开发服务
bun run routes:generate  # 重新生成 TanStack Router route tree
bun run typecheck        # 运行 TypeScript 检查
bun run lint             # 运行 ESLint
bun run format           # 格式化文件
bun run format:check     # 检查格式
bun run build            # 构建生产产物
bun run preview          # 预览生产构建
bun run knip             # 检查未使用文件、导出和依赖
```

## 技术栈

- React 19
- TypeScript 5.9
- Rsbuild 2
- TanStack Router
- TanStack Query
- Zustand
- shadcn/ui 和 Radix primitives
- Tailwind CSS v4
- TanStack Table 和 TanStack Virtual
- React Hook Form 和 Zod
- Recharts
- Motion
- i18next 和 react-i18next
- Axios
- Sonner
- cmdk
- Vaul
- next-themes

## 安全说明

- 请将 management key 视为敏感信息。
- 优先使用本机或私有网络的管理访问。
- 如果启用远程管理，请使用 HTTPS 和严格的服务端访问控制。
- 不要在不了解认证和网络限制的情况下，将管理端点暴露到公网。
- 浏览器存储不是密钥保险箱。处理敏感操作时，建议使用专用浏览器配置或私有环境。

## 常见问题

### 这是后端服务吗？

不是。本仓库只包含前端控制台，需要一个正在运行的 CLIProxyAPIHome 后端来提供管理数据并执行管理操作。

### 这个项目会转发模型请求吗？

不会。模型请求转发由后端服务处理。本项目只提供基于浏览器的管理界面。

### 可以连接远程后端吗？

可以，前提是后端启用了远程管理，并通过合适的网络、HTTPS 和认证设置进行了保护。

## 文档

- `PRODUCT.md`：产品定位、用户、产品任务和 UX 原则。
- `DESIGN.md`：视觉系统、布局原则、组件行为和 UI 质量规则。
- `AGENTS.md`：Coding Agent 在本仓库工作时的指导文件。
- `CLAUDE.md`：与 `AGENTS.md` 对齐的 Claude Code 指导文件。

## 贡献

欢迎提交 Issue 和 Pull Request。

提交 bug 时，请尽量包含：

- 后端版本。
- 浏览器和操作系统。
- 复现步骤。
- UI 问题的截图或录屏。
- 相关的 Console 或 Network 错误信息。

提交 Pull Request 时，请尽量包含：

- 简洁的变更说明。
- 可见 UI 变更的截图。
- 后端 API 兼容性说明。
- 已运行的验证命令，例如：

```bash
bun run typecheck
bun run lint
bun run format:check
bun run build
```

## 许可证

本项目基于 MIT License 开源。详情请参见 [LICENSE](LICENSE)。
