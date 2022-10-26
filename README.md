# Super Translator

这个项目用来帮助我们更好的浏览英文页面，通过中英文对照的形式阅读，在快速阅读页面的同时，也很好的解决了目前市面上翻译软件对专业词汇翻译不准确的问题。

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
