# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

DevGo 是一个面向开发者的 Chrome MV3（同时支持 Firefox）浏览器扩展，技术栈为 **WXT + React + TypeScript + Tailwind CSS v4**。核心功能：翻译（弹窗查词 / 整页行间翻译 / 划词气泡）、GitHub 增强、新标签页、网络代理切换、CORS 调试，以及媒体资源嗅探与下载。

## 常用命令

```bash
pnpm dev              # 开发服务（Chrome），端口 3000
pnpm dev:firefox      # 开发服务（Firefox）
pnpm build            # 生产构建（Chrome）→ .output/
pnpm build:firefox
pnpm zip              # 打包 zip
pnpm compile          # tsc --noEmit（类型检查）
pnpm lint             # eslint .
pnpm lint:fix
pnpm prettier         # 格式化全部文件
```

本项目没有测试套件。完成任何改动前，请运行 `lint-staged` 会执行的检查（见 `AGENTS.md`）：

```bash
pnpm compile
pnpm exec eslint <改动的 .ts/.tsx/.js/.mjs/.cjs 文件>
pnpm exec prettier --check <改动的文件>
```

提交会经过 Husky + commitlint（约定式提交，见 `.cz-config.cjs`）；可用 `pnpm cz` 走交互式提交。发布用 `pnpm release`（standard-version）。

## 架构

这是一个**多上下文扩展**。代码运行在三个相互隔离的环境中，它们只能通过消息层通信——切勿假设它们之间共享内存状态：

1. **后台 Service Worker**——唯一的中枢，所有特权 Chrome API 都在这里。入口 `src/entrypoints/background.ts` 只负责同步注册监听（MV3 SW 会被回收重启，监听必须在入口同步注册）；具体逻辑按职责放在 `src/background/`：`router.ts`（runtime 消息路由）、`translate.ts`（划词翻译/查词/测试）、`proxy.ts`（代理模式与规则列表）、`cors.ts`（CORS 动态规则与跨域代理）、`media.ts`（`webRequest` 媒体嗅探与下载）、`commands.ts`（快捷键与右键菜单）、`migration.ts`（存储迁移）。跨设备同步镜像在 `src/utils/sync-mirror.ts`。
2. **内容脚本**（`src/entrypoints/*.content.ts(x)`）——注入到页面：`translate.content.ts`（整页行间翻译）、`selection.content.tsx`（划词气泡 UI）、`github.content.tsx`、`media.content.ts`（媒体资源 DOM 采集）、`unlock.content.ts`（按站点解除复制/选择限制，只在用户开启的站点生效）、`cors-bridge.content.ts`。
3. **扩展 UI 页面**——`popup/`、`newtab/`、`options/`，各自是标准 React 应用（`index.html` + `main.tsx` + `App.tsx`）。popup 是主控制面板（4 个 Tab：默认 / 待办 / 网络 / 资源）。

### 跨上下文通信——`src/utils/messaging.ts`

这是把各上下文串起来的契约。**所有消息类型及其响应结构都在此处以类型化联合（union）定义——新增任何跨上下文行为时先读这个文件。**

- `RuntimeMessage` + `RuntimeResponseMap`：向后台发起的请求/响应（translate、lookup、cors-proxy-fetch、网络模式、媒体等）。用 `sendRuntimeMessage(msg)` 发送——返回类型由消息的 `type` 推断。
- `TabMessage`：后台/Popup → 某个标签页的内容脚本（translate-page、tip、collect-media-resources）。用 `sendTabMessage(msg)` 发送。
- `PopupShortcutMessage`：后台 → Popup，用于按键盘命令切换/关闭面板。

新增跨上下文功能时：在 `messaging.ts` 的联合类型里加上变体，在 `src/entrypoints/background.ts` 的 `registerMessageRouter({...})` 处理表里加上对应处理函数（漏写会编译报错），再通过类型化的 helper 调用。处理函数抛错时路由会回复错误，`sendRuntimeMessage` 会 reject，调用方需处理异常。

### 持久化状态——`src/utils/settings.ts`

所有用户设置都是 WXT 的 `storage.defineItem` 项（`local:` 键）并带 fallback。它们是响应式的、跨所有上下文共享——导入对应项后调用 `.getValue()` / `.setValue()` / `.watch()`。不要直接读 `chrome.storage`。`src/utils/backup.ts` 负责把这些设置序列化用于导入/导出。

### 其他关键工具（`src/utils/`）

`network.ts`（代理 PAC/AutoProxy 规则处理、bypass 列表规范化）、`media.ts`、`theme.ts`、`shortcut.ts`、`no-translate.ts` / `content-settings.ts`（标记浏览器不应自动翻译的元素/页面）、`actionIcon.ts`。

`src/api/` 封装翻译/词典服务商（`translator.ts`、`microsoft.ts`、`lookup.ts`）。`src/features/` 是各功能模块的 React/逻辑实现；`src/ui/` 是通用组件；`src/types/` 是业务类型。

## 约定

- **WXT 自动导入已启用**：`browser`、`storage`、`defineBackground`、`defineContentScript`、React hooks 等无需显式导入即可使用。`src/` 路径用 `@/` 别名。
- 仅作类型用途的导入使用 `import type`；回调中刻意不用的参数加 `_` 前缀。（`@typescript-eslint/no-unused-vars` 和 `no-shadow` 是 error；`no-explicit-any` 是 warn。）
- `manifest` 及入口映射由 WXT 根据 `wxt.config.ts` 和 `entrypoints/` 文件名生成——不要手写 manifest。新增权限/命令写在 `wxt.config.ts`。
- Firefox 没有 `favicon` 权限；像 `wxt.config.ts` 那样按浏览器对 Chrome 专有 API 做守卫。

## 本地专属文件（已 gitignore——切勿提交）

- `web-ext.config.ts`——本地浏览器启动偏好（`webExt` 配置放这里，不要放进 `wxt.config.ts`）。
- `devgo-backup.json`——开发用种子备份，构建时作为 `DEVGO_BACKUP_JSON` define 注入（见 `wxt.config.ts` + `src/utils/dev-backup.ts`）；含个人数据。
