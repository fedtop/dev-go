# DevGo

这个项目包含一些提升效率的工具。用来在浏览器中帮助我们完成一些繁杂或者重复的工作，或者提升我们使用浏览器的阅读体验。

下载插件：👉🏻 [Chrome 应用商店的链接](https://chrome.google.com/webstore/detail/devgo/kcofdbjhicjdbmldlcffcijglkifnnjn)

使用文档：👉🏻 [DevGo 使用文档](https://fedtop.github.io/dev-go-docs)

## 贡献者们

[Contributors](https://github.com/wangrongding/dev-go/graphs/contributors) 是 DevGo 的未来。

<a href="https://github.com/fedtop/dev-go/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=fedtop/dev-go" />
</a>

## 所有功能

### Done

- [x] [翻译](#翻译)
- [x] [优化浏览器中自带的翻译页面](#优化浏览器中自带的翻译页面)
- [x] [github 添加在线编辑按钮](#github添加在线编辑按钮)
- [x] [去除外链跳转的提示](#去除外链跳转的提示)
- [x] [去除外链跳转的提示](#去除外链跳转的提示)
- [x] [清除用户事件的限制](#清除用户事件的限制)

### Todo

- [ ] P2P 传输文件 -（wip）
- [ ] 保存页面为 PDF
- [ ] 保存页面为 MarkDown
- [ ] 浏览器代理
- [ ] 图片处理工具
- [ ] Json 格式化
- [ ] 视频解析
- [ ] Mock 数据
- [ ] 番茄钟
- [ ] 代办事项提醒
- [ ] github 回到顶部

欢迎提 Issue 和 PR。共同完善这个插件集合。

## 功能介绍

### 翻译

查单词短句，可以通过快捷键 `Alt+Q`/`Option+Q` 或者点击插件图标打开该窗口。

<img src='https://assets.fedtop.com/picbed/202212052303602.png' width='700px'>

翻译页面-通过中英文对照的形式阅读，在快速阅读页面的同时，也很好的解决了目前市面上翻译软件对专业词汇翻译不准确的问题。

可以通过快捷键 `Ctrl+Shift+E`/`Command+Shift+E` 快速翻译当前页面。

<img src='https://assets.fedtop.com/picbed/202212052313001.png' width='700px'>

划词翻译、右键菜单翻译,这两天加上

### 优化浏览器中自带的翻译页面

所有站点过滤掉代码块等不需要翻译的元素，为 github 定制化过滤了不需要翻译的元素

优化浏览器中自带的翻译，标记了一些不该被翻译的元素（比如代码块，github 中一些导航），让浏览器自带的翻译在翻译页面时跳过被标记的标签。

<img src='https://assets.fedtop.com/picbed/202212052322835.png' width='700px'>

### github 添加在线编辑按钮

github 添加在线编辑按钮并且可以使用快捷键 ","直接进入。 方便快速使用 `1s` 查看代码，（为什么？因为 1s 比 通过 github 页面中快捷键"句号"调出的 github.dev 要快）。

<img src='https://assets.fedtop.com/picbed/202210280935904.png' width='700px'>

### 去除外链跳转的提示

每次在知乎，掘金，简书...中打开外链，都有一个跳转提示，需要手动点击确定才能跳转，很难受，这里捕获后直接重定向到目标链接。

<img src='https://assets.fedtop.com/picbed/202211091022789.png' width='700px'>

### 清除用户事件的限制

在一些网站中 copy 文本后常常后面附带一些版权信息等，很烦,清除了网站对用户行为进行了限制（比如右击菜单，选择文本，拷贝，剪切，键盘鼠标事件等）

<img src='https://assets.fedtop.com/picbed/202212052328159.png' width='700px'>

## 开发

> 本项目已从 Plasmo 迁移到 [WXT](https://wxt.dev)（下一代 Web 扩展开发框架）。

### 运行

首先安装依赖并启动开发服务：

```bash
pnpm install
pnpm dev
# 调试 Firefox
pnpm dev:firefox
```

WXT 会自动打开浏览器并加载扩展（产物位于 `.output/chrome-mv3` 等目录），保存文件时支持热更新（HMR）。

#### 项目结构

```
src/
├─ entrypoints/        # 扩展入口（WXT 文件路由，自动写入 manifest）
│  ├─ background.ts          # 后台 Service Worker
│  ├─ translate.content.ts   # 整页对比翻译
│  ├─ link-go.content.ts     # 去除外链跳转中转页
│  ├─ unlock.content.ts      # 解除复制/选择限制
│  ├─ github.content.tsx     # GitHub 增强（Shadow DOM + React）
│  ├─ popup/                 # 弹窗页（React）
│  ├─ options/               # 选项页（React）
│  └─ newtab/                # 新标签页（React）
├─ api/                # 翻译接口封装
├─ components/         # 公共组件
├─ features/           # 按功能拆分的业务模块
├─ utils/              # 工具与类型安全的消息协议
└─ assets/             # 样式与图标（图标自动生成各尺寸）
```

进一步指导 👉🏻 [WXT 文档](https://wxt.dev)

### 打包

构建生产产物：

```bash
pnpm build          # Chrome (MV3)
pnpm build:firefox  # Firefox
```

打包成可上传商店的 zip：

```bash
pnpm zip
pnpm zip:firefox
```

产物输出在 `.output/` 目录。

### 提交到网上商店

CI 中使用 [bpp](https://bpp.browser.market) GitHub Action 自动提交（见 `.github/workflows/submit.yml`），需先手动上传一次版本以建立凭证。

## 赞赏

只需要点一个 Star⭐️ 支持我们~

🌸Let's enjoy it!
