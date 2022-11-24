# 基于 Plasmo 搭建浏览器插件

## 创建项目

```bash
pnpm create plasmo --with-src
# or
npx init-plasmo --with-src
```

## 右键菜单

<!-- TODO -->

## 快捷键

<!-- TODO -->

## content-scripts

是 Chrome 插件中向页面注入脚本的一种形式。 content-scripts 能访问 DOM，但 不能访问绝大部分 `chrome.xxx.api`。

在 content-script 中的 CSS，用图片的方式

1 在 Mainfast 中，将图片的路径设置在访问的插件资源列表中，例如

```
  "web_accessible_resources": ["images/*"],
```

2 CSS 中用 `url(chrome-extension://__MSG_@@extension_id__/图片的路径)` 来写。如:

```
  background-image: url(chrome-extension://__MSG_@@extension_id__/images/xx.png)
```

当然，也可用 base64 的方式来做。

## 动态注入资源

### 注入 JS

bacground 和 popup 的 js 不能直接访问 DOM。当通过在 bacground 或 popup 中 注入 js，动态注入的 js 可以访问 DOM。

```
// 注入文件
chrome.tabs.executeScript(null, {
  file: "路径"
})

// 注入代码
chrome.tabs.executeScript(null, {
  code: 'document.body.style.backgroundColor="red"'
})
```

需要在 `manifest.json` 中配置对应的配置：

```
"permissions": [ "tabs", "activeTab", "<all_urls>" ],
```

`"<all_urls>"` 也可以改成, `"http://*/*", "https://*/*"`

## 事件

图标被点击

```
chrome.browserAction.onClicked.addListener(function() {

})
```

## Popup 和 background 的通信

popup 可以直接调用 background 中的 JS 方法，也可以直接访问 background 的 DOM：

```
// background.js
function test()
{
  alert('我是background！');
}

// popup.js
var bg = chrome.extension.getBackgroundPage();
bg.test(); // 访问bg的函数
alert(bg.document.body.innerHTML)
```

background 调用 popup 的代码如下（前提是 popup 已经打开）

```
var views = chrome.extension.getViews({type:'popup'});
if(views.length > 0) {
  console.log(views[0].location.href);
}
```

## popup 和 background 向 content 发信息

background.js 或者 popup.js

```
function sendMessageToContentScript(message, callback)
{
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs)
  {
    chrome.tabs.sendMessage(tabs[0].id, message, function(response)
    {
      if(callback) callback(response);
    });
  });
}

// cmd 是类型
sendMessageToContentScript({cmd:'test', value:'你好，我是popup！'}, function(response)
{
  console.log('来自content的回复：'+response);
})
```

content-script.js 接发信息

```
// 接收信息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse)
{
  // console.log(sender.tab ?"from a content script:" + sender.tab.url :"from the extension")
  // 根据不同类别做不同处理
  if(request.cmd == 'test') alert(request.value);
  sendResponse('我收到了你的消息！')
})

// 发送信息
chrome.runtime.sendMessage({
  method: "xxx", // 调用函数
  cmd: 'xxx', // 执行命令。接受
}, { // 发送的信息

}, function(re) {
  sender()
})
```

要注意的是：**chrome.runtime.sendMessage 的回调函数默认是同步的，而且超时后直接执行，返回 undefined，如果要异步执行，必须在处理函数中 return true。**

## 本地存储

推荐用`chrome.storage`而不是普通的`localStorage`。最重要的 2 点区别是：

- chrome.storage 是针对插件全局的，即使你在 background 中保存的数据，在 content-script 也能获取到；
- chrome.storage.sync 可以跟随当前登录用户自动同步，这台电脑修改的设置会自动同步到其它电脑，很方便，如果没有登录或者未联网则先保存到本地，等登录了再同步至网络；

需要声明 storage 权限，有 chrome.storage.sync 和 chrome.storage.local2 种方式可供选择，使用示例如下：

```
// 读取数据，第一个参数是指定要读取的key以及设置默认值
chrome.storage.sync.get({color: 'red', age: 18}, function(items) {
  console.log(items.color, items.age);
});
// 保存数据
chrome.storage.sync.set({color: 'blue'}, function() {
  console.log('保存成功！');
})
```

## 发布到 Chrome 商店

在插件管理页有一个打包按钮，然后会生成 .crx 文件。npm 上也有打包的包。

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

## Manifest V3

- [升级到 V3 遇到的一些问题：](https://blog.csdn.net/lxm1353723767/article/details/127706101)
-

```
{
  // 清单文件的版本，这个必须写，而且必须是2
  "manifest_version": 2,
  // 插件的名称
  "name": "demo",
  // 插件的版本
  "version": "1.0.0",
  // 插件描述
  "description": "简单的Chrome扩展demo",
  // 图标，一般偷懒全部用一个尺寸的也没问题
  "icons":
  {
    "16": "img/icon.png",
    "48": "img/icon.png",
    "128": "img/icon.png"
  },
  // 会一直常驻的后台JS或后台页面
  "background":
  {
    // 2种指定方式，如果指定JS，那么会自动生成一个背景页
    "page": "background.html"
    //"scripts": ["js/background.js"]
  },
  // 浏览器右上角图标设置，browser_action、page_action、app必须三选一
  "browser_action":
  {
    "default_icon": "img/icon.png",
    // 图标悬停时的标题，可选
    "default_title": "这是一个示例Chrome插件",
    "default_popup": "popup.html"
  },
  // 当某些特定页面打开才显示的图标
  /*"page_action":
  {
    "default_icon": "img/icon.png",
    "default_title": "我是pageAction",
    "default_popup": "popup.html"
  },*/
  // 需要直接注入页面的JS
  "content_scripts":
  [
    {
      //"matches": ["http://*/*", "https://*/*"],
      // "<all_urls>" 表示匹配所有地址
      "matches": ["<all_urls>"],
      // 多个JS按顺序注入
      "js": ["js/jquery-1.8.3.js", "js/content-script.js"],
      // JS的注入可以随便一点，但是CSS的注意就要千万小心了，因为一不小心就可能影响全局样式
      "css": ["css/custom.css"],
      // 代码注入的时间，可选值： "document_start", "document_end", or "document_idle"，最后一个表示页面空闲时，默认document_idle
      "run_at": "document_start"
    },
    // 这里仅仅是为了演示content-script可以配置多个规则
    {
      "matches": ["*://*/*.png", "*://*/*.jpg", "*://*/*.gif", "*://*/*.bmp"],
      "js": ["js/show-image-content-size.js"]
    }
  ],
  // 权限申请
  "permissions":
  [
    "contextMenus", // 右键菜单
    "tabs", // 标签
    "notifications", // 通知
    "webRequest", // web请求
    "webRequestBlocking",
    "storage", // 插件本地存储
    "http://*/*", // 可以通过executeScript或者insertCSS访问的网站
    "https://*/*" // 可以通过executeScript或者insertCSS访问的网站
  ],
  // 普通页面能够直接访问的插件资源列表，如果不设置是无法直接访问的
  "web_accessible_resources": ["js/inject.js"],
  // 插件主页，这个很重要，不要浪费了这个免费广告位
  "homepage_url": "https://www.baidu.com",
  // 覆盖浏览器默认页面
  "chrome_url_overrides":
  {
    // 覆盖浏览器默认的新标签页
    "newtab": "newtab.html"
  },
  // Chrome40以前的插件配置页写法
  "options_page": "options.html",
  // Chrome40以后的插件配置页写法，如果2个都写，新版Chrome只认后面这一个
  "options_ui":
  {
    "page": "options.html",
    // 添加一些默认的样式，推荐使用
    "chrome_style": true
  },
  // 向地址栏注册一个关键字以提供搜索建议，只能设置一个关键字
  "omnibox": { "keyword" : "go" },
  // 默认语言
  "default_locale": "zh_CN",
  // devtools页面入口，注意只能指向一个HTML文件，不能是JS文件
  "devtools_page": "devtools.html"
}
```

## 开发相关链接

- [Plasmo 文档](https://www.plasmo.com/)
- [谷歌开发文档](https://developer.chrome.com/docs/)
- [Chrome 扩展开发文档](https://wizardforcel.gitbooks.io/chrome-doc/content/1.html)
- [手把手教你写扩展](https://juejin.cn/post/6844904077889912839)
- [示例](https://github.com/GoogleChrome/chrome-extensions-samples)
- [Chrome 插件开发教程](https://xieyufei.com/2021/11/09/Chrome-Plugin.html)
- [Chrome 插件开发教程](https://blog.csdn.net/qq_34998786/article/details/121782426)
- [谷歌开发文档](https://developer.chrome.com/)
- [创建 Chrome 应用集 ](https://support.google.com/chrome/a/answer/2649489)
- [插件权限说明](https://developer.chrome.com/docs/extensions/mv3/declare_permissions/)
- [Chrome 插件开发全攻略](https://github.com/sxei/chrome-plugin-demo)

## 发布相关链接

- [应用商店管理后台](https://chrome.google.com/webstore/devconsole)
- [Workspace Cloud](https://workspace.google.com/)
- [console.cloud.google](https://console.cloud.google.com/apis)
- [Admin google](https://admin.google.com/)
- [Google Cloud](https://cloud.google.com/)

- [自动发布](https://www.jianshu.com/p/6c552290ccea)
- https://github.com/PlasmoHQ/chrome-webstore-api/blob/main/token.md

## 一些注册教程

- [注册扩展开发者](https://www.zhihu.com/column/p/27203832)
- [](https://blog.csdn.net/ytlzq0228/article/details/105682567)
- [土豪专用！Google 企业邮箱注册试用及详细使用教程（图文）](https://www.imhunk.com/how-to-apply-for-google-company-email-g-suite/)
- [注册为 Chrome 应用商店开发者 5$](https://chrome.google.com/webstore/devconsole/register)
- [创建 Play 管理中心开发者帐号 25$](https://play.google.com/console/u/0/signup)
- [如何注册 Google Play 开发者账号（含收款设置）](https://juejin.cn/post/6844903829033484302)
- [如何注册 Google Play 开发者账号（含收款设置）](https://juejin.cn/post/6907214824216723464)
- [如何注册 visa 卡](https://www.bilibili.com/read/cv11596922)
- [Google Play](https://pay.google.com/gp/w/u/0/home/signup)
