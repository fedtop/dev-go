# 基于 Plasmo 搭建浏览器插件

## 创建项目

```bash
pnpm create plasmo --with-src
# or
npx init-plasmo --with-src
```

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
