# DevGo

DevGo 是一个面向开发者的浏览器效率扩展，聚焦翻译、GitHub 增强、新标签页效率工具与页面调试辅助能力。

下载插件：👉🏻 [Chrome 应用商店](https://chrome.google.com/webstore/detail/devgo/kcofdbjhicjdbmldlcffcijglkifnnjn)

使用文档：👉🏻 [DevGo 使用文档](https://fedtop.github.io/dev-go-docs)

## 功能概览

- 翻译能力
  - 弹窗查词（有道 / 微软 / Google）
  - 整页行间翻译（支持再次点击还原）
  - 划词翻译气泡（单词会并行展示词典结果）
- GitHub 增强
  - 代码页悬浮快捷按钮：在线编辑、DeepWiki、回到顶部
  - 键盘快捷键 `,` 一键打开 github1s
- 网页体验增强
  - 去除掘金 / 知乎 / 简书外链中转页
  - 解除部分站点复制/剪切/选择限制
  - 标记不应被浏览器翻译的页面元素（含 GitHub 场景）
- 开发调试能力
  - 可开关的 CORS 调试辅助（针对网页 XHR/fetch 响应补充 CORS 头）
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
│  ├─ background.ts        # 后台消息与翻译/CORS 调度
│  ├─ translate.content.ts # 整页行间翻译
│  ├─ selection.content.tsx# 划词翻译 UI
│  ├─ github.content.tsx   # GitHub 增强 UI
│  ├─ link-go.content.ts   # 外链中转页直达
│  ├─ unlock.content.ts    # 解除复制/选择限制
│  ├─ cors-bridge.content.ts
│  ├─ cors-proxy.ts
│  ├─ popup/
│  ├─ options/
│  └─ newtab/
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
