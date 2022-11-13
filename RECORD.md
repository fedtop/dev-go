# 基于 Plasmo 搭建浏览器插件

## 创建项目

```bash
pnpm create plasmo --with-src
# or
npx init-plasmo --with-src
```

## 发布到 Chrome 商店

首先，你需要一个 Chrome 开发者账号。如果你还没有，请访问[这里](https://chrome.google.com/webstore/developer/dashboard)。需要缴纳 5$ 的费用。而且这里很坑的是，我每一次填写信息绑定卡片的时候都会扣 1$的费用，选择香港，转大陆，信用卡，visa 等几种支持的。

然后，第一次上传扩展程序时，你需要手动把构建好的文件夹压缩成 zip 文件，然后上传到 Chrome 商店。

## chrome 插件开发本地调试

- 调试 popup.html 页面：右键点击浏览器右上角插件图标，然后选择点击"审查弹出内容"。
- 调试 background.html 或 background.js：在浏览器的扩展程序管理页面找到自己加载的扩展程序，然后点击"Service Worker"（MV2 则是"背景页"）。
- 调试 content_scripts.js：在注入的页面按 F12，和正常页面一样调试。
- 调试 options.html 页面：右键点击浏览器右上角插件图标，然后选择点击"选项"，打开插件的选项页，然后按 F12，和正常页面一样调试。

## chrome 插件的组成主要由以下部分组成：

- manifest.json （配置文件，目前最新是 v3 版本）
- popup (点击插件图标弹出的页面)
- content script (插入到目标页面中执行的 JS)
- background script (在浏览器后台 Service Workers 中运行的程序)
- options (选项页面，可有可无)

## chrome 插件的能力

除了支持传统的一切 web API、JavaScript API 以外，chrome 插件额外支持以下 API（chrome.xxx）：

- bullet 浏览器窗口（chrome.window）
- tab 标签（chrome.tabs）
- 书签（chrome.bookmark）
- 历史（chrome.history）
- 下载（chrome.download）
- 网络请求（chrome.webRequest）
- 自定义右键菜单（chrome.contextMenus）
- 开发者工具扩展（chrome.devtool）
- 插件管理（chrome.extension）

## manifest v3 的主要特性

- Service Workers 取代 background pages，使用 Service Workers，可对资源进行缓存，从而实现离线访问。
- 网络请求调整，新增了一个 declarativeNetRequestAPI，允许插件修改及阻断网络请求。
- 远程资源访问限制，禁止访问外部的 JavaScript 及 Wasm 文件，图片、音视频文件不受影响。
- Promises 使用，可以愉快地使用 promise 了，包括 async/await。
- manifest 文件的部分配置和 chrome API 做了部分调整。

## 注意事项

- 在 MV3 中，由于 Service Workers 的机制，background 页中不支持使用 XMLHttpRequest，建议使用 fetch()
- popup 可以直接调用 background 中的 JS 方法，也可以直接访问 background 的 DOM。
- 在对 popup 页面审查元素的时候 popup 会被强制打开无法关闭，只有控制台关闭了才可以关闭 popup，原因很简单：如果 popup 关闭了控制台就没用了。
- chrome.tabs.connect 或 chrome.tabs.sendMessage 不能用于与选项页面通信，选项页面可以使用 chrome.runtime.connect 和 chrome.runtime.sendMessage 与 background 页通信。
- content script 文件中可以获取 web 页面的 DOM 并修改，content script 和原始页面共享 DOM，但是不共享 JS，JS 是相互隔离的，可以通过 window.postMessage 和 window.addEventListener 来实现二者消息通讯。
- content script 不能发送跨域请求。????
- content script 文件中只能使用下面列出的 API:

```ts
chrome.extension
chrome.i18n
chrome.runtime
chrome.storage
```

## 相关链接

- [应用商店管理后台](https://chrome.google.com/webstore/devconsole)
- [Workspace Cloud](https://workspace.google.com/)
- [console.cloud.google](https://console.cloud.google.com/apis)
- [Admin google](https://admin.google.com/)
- [Google Cloud](https://cloud.google.com/)

- [谷歌开发文档](https://developer.chrome.com/)
- [Chrome 插件开发教程](https://xieyufei.com/2021/11/09/Chrome-Plugin.html)
- [Chrome 插件开发教程](https://blog.csdn.net/qq_34998786/article/details/121782426)
- [创建 Chrome 应用集 ](https://support.google.com/chrome/a/answer/2649489)
- [插件权限说明](https://developer.chrome.com/docs/extensions/mv3/declare_permissions/)

## 一些注册教程

- [](https://blog.csdn.net/ytlzq0228/article/details/105682567)
- [土豪专用！Google 企业邮箱注册试用及详细使用教程（图文）](https://www.imhunk.com/how-to-apply-for-google-company-email-g-suite/)

- [注册为 Chrome 应用商店开发者 5$](https://chrome.google.com/webstore/devconsole/register)
- [创建 Play 管理中心开发者帐号 25$](https://play.google.com/console/u/0/signup)
- [如何注册 Google Play 开发者账号（含收款设置）](https://juejin.cn/post/6844903829033484302)
- [如何注册 Google Play 开发者账号（含收款设置）](https://juejin.cn/post/6907214824216723464)
- [如何注册 visa 卡](https://www.bilibili.com/read/cv11596922)
- [Google Play](https://pay.google.com/gp/w/u/0/home/signup)
