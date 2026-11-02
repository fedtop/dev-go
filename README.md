# DevGo

DevGo 是一个面向开发者的浏览器效率扩展，聚焦翻译、GitHub 增强、新标签页效率工具与页面调试辅助能力。

下载插件：👉🏻 [Chrome 应用商店](https://chrome.google.com/webstore/detail/devgo/kcofdbjhicjdbmldlcffcijglkifnnjn)

使用文档：👉🏻 [DevGo 使用文档](https://fedtop.github.io/dev-go-docs)

## 功能概览

- 翻译能力
  - 弹窗查词（有道 / 微软 / Google）
  - 整页行间翻译（支持再次点击还原）
  - 划词工具条：翻译（单词并行展示词典结果）、AI 解释 / 总结（附带段落上下文）、问 AI；输入框内选中文字可 AI 润色 / 纠错 / 改正式并一键替换
  - 整页翻译支持 Shadow DOM / Web Components 页面
  - 翻译模型与对话模型分开配置：翻译选快的，解释 / 助手选强的
- GitHub 增强
  - 代码页悬浮快捷按钮：在线编辑、DeepWiki、回到顶部
  - 键盘快捷键 `,` 一键打开 github1s
- 网页体验增强
  - 按站点解除复制 / 选择 / 右键限制（在弹窗「功能」页对当前站点开启，设置页「网页增强」管理全部站点）
  - 标记不应被浏览器翻译的页面元素（含 GitHub 场景）
- 隐私防护（设置页「隐私防护」）
  - WebRTC IP 防泄露：隐藏内网 IP，或强制 WebRTC 只经代理连接，开着代理也不暴露真实 IP（`privacy` 为可选权限，开启时才申请）
  - 可选彻底屏蔽网页的 WebRTC 接口、隐藏摄像头和麦克风（document_start 注入网页主环境，网页无法绕过）
  - 内置泄露自测：在最近使用的网页里实测网站能拿到哪些地址
- 开发调试能力
  - 可开关的 CORS 调试辅助（针对网页 XHR/fetch 响应补充 CORS 头）
  - 网络面板：直连 / 系统代理 / 自动模式 / 代理模式快速切换，自动模式、代理模式与自定义代理模式分别保存代理服务器和绕过列表，自动模式支持 AutoProxy 规则列表（定时自动更新）、自定义代理域名，以及未命中规则时直连或走代理
- AI 助手（侧边栏，Alt+2）
  - 一键总结本页 / 提取要点，就网页内容提问（AI 可自行读取网页正文）；划词「问 AI」带着选中内容过来
  - 支持各家 OpenAI 兼容服务与 Coding Plan，回答流式输出、展示思考过程
  - WebMCP：自动列出网页通过 WebMCP 注册的工具（含 iframe），AI 可调用它们完成任务；未声明只读的工具执行前确认（需要 Chrome 150+ 并在 chrome://flags 开启「WebMCP for testing」）
- 设置页：独立标签页，分为翻译 / AI 模型 / 划词 / AI 助手 / 网络代理 / 网页增强 / 通用（快捷键、跨设备同步、数据备份）；弹窗只保留与当前页面相关的操作
- 新标签页
  - 搜索引擎切换 + bang 语法
  - 快捷导航增删改拖拽排序
  - 聚合导航与书签的搜索联想
  - 主题切换与配置导入导出

## 技术栈

- 框架：WXT + React + TypeScript
- 样式：Tailwind CSS
- 运行时：Chrome MV3（支持 Firefox 构建）

## 本地开发

安装依赖：

```bash
pnpm install
```

启动开发：

```bash
pnpm dev
pnpm dev:firefox
```

代码检查：

```bash
pnpm compile
pnpm eslint
pnpm prettier
```

## 构建与打包

构建产物：

```bash
pnpm build
pnpm build:firefox
```

打包 zip：

```bash
pnpm zip
pnpm zip:firefox
```

## 项目结构

```text
src/
├─ entrypoints/            # WXT 入口（自动映射 manifest）
│  ├─ background.ts        # 后台入口：只注册监听，逻辑见 src/background/
│  ├─ translate.content.ts # 整页行间翻译
│  ├─ selection.content.tsx# 划词工具条（翻译 + AI 动作）
│  ├─ github.content.tsx   # GitHub 增强 UI
│  ├─ unlock.content.ts    # 按站点解除复制/选择限制
│  ├─ assistant.content.ts # 助手桥：读取网页正文、读取 / 执行 WebMCP 工具
│  ├─ sidepanel/           # 侧边栏：AI 助手
│  ├─ cors-bridge.content.ts
│  ├─ cors-proxy.ts
│  ├─ popup/
│  ├─ options/
│  └─ newtab/
├─ background/             # 后台各模块（消息路由、代理、CORS、媒体嗅探、命令）
├─ api/                    # 翻译与查词接口封装
├─ features/               # 各功能模块实现
├─ ui/                     # 通用 UI 组件
├─ utils/                  # 设置、消息协议、主题与快捷键工具
├─ types/                  # 业务类型定义
└─ assets/                 # 样式与静态资源
```

## 贡献

欢迎提 Issue 和 PR，共同完善 DevGo。

贡献者列表：[Contributors](https://github.com/wangrongding/dev-go/graphs/contributors)

<a href="https://github.com/fedtop/dev-go/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=fedtop/dev-go" />
</a>
