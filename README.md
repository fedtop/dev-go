# Super Extensions

这个项目用来帮助我们在日常开发中完成一些繁杂的工作，以及一些提升效率的工具。

## 目前的功能

### 翻译

查单词短句

![](https://assets.fedtop.com/picbed/202211011327471.png)

翻译页面-通过中英文对照的形式阅读，在快速阅读页面的同时，也很好的解决了目前市面上翻译软件对专业词汇翻译不准确的问题。

![](https://assets.fedtop.com/picbed/202210270939667.png) 划词翻译、右键菜单翻译

这两天加上

### github 添加在线编辑按钮

方便快速使用 `1s` 查看代码，（1s 比 快捷键句号调出的 github.dev 要快）

![](https://assets.fedtop.com/picbed/202210280935904.png)

### 优化浏览器中自带的翻译页面

所有站点过滤掉代码块等不需要翻译的元素，为 github 定制化过滤了不需要翻译的元素

![](https://assets.fedtop.com/picbed/202210280048017.png)

### 保存页面为 PDF -（wip）

### 保存页面为 MarkDown -（wip）

### 浏览器代理 -（wip）

### 图片处理工具 -（wip）

### Json 格式化 -（wip）

### 视频解析 -（wip）

### Mock 数据 -（wip）

### 番茄钟 -（wip）

### 代办事项提醒 -（wip）

欢迎提 Issue 和 PR。共同完善这个插件集合。

## 开发

首先，运行服务：

```bash
npm run dev
# or
pnpm dev
```

打开浏览器并加载适当的开发构建。例如，如果你正在为 chrome 浏览器开发，使用 manifest v3，使用:`build/chrome-mv3-dev`。

![](https://assets.fedtop.com/picbed/202210270156535.png)

你可以通过修改 `popup.tsx` 开始编辑弹出窗口。它应该在您进行更改时自动更新。要添加选项页面，只需添加一个 `options.tsx` 文件到项目的根，并导出一个默认的 react 组件。同样，要添加内容页，请添加 `content.ts` 文件到项目根目录，导入一些模块并执行一些逻辑，然后在浏览器上重新加载扩展。

进一步指导 👉🏻[plasmo docs](https://docs.plasmo.com/)

## 打包成 crx 文件

运行以下:

```sh
npm run build
# or
pnpm build
```

这将为您的扩展创建一个生产包，准备压缩并发布到商店。

## 提交到网上商店

部署 plasmo 扩展最简单的方法是使用内置的[bpp](https://bpp.browser.market) GitHub action 。但是，在使用此操作之前，请确保构建您的扩展并将第一个版本上传到存储中以建立基本凭证。然后，只需遵循 [此设置说明](https://docs.plasmo.com/workflows/submit)，您就可以自动提交了!
