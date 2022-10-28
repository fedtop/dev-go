import { injectToNode } from "~script/injector"
import { setNotranslateNode } from "~script/set-no-translate-node"

interface TranslateElements {
  elements: NodeListOf<HTMLElement>
  tag: keyof HTMLElementTagNameMap
}

chrome.runtime.onMessage.addListener(() => {
  // 需要翻译的元素
  const translateElements: TranslateElements[] = [
    {
      elements: document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
      tag: "span"
    },
    {
      elements: document.querySelectorAll("p"),
      tag: "span"
    },
    {
      elements: document.querySelectorAll("li"),
      tag: "span"
    }
  ]
  // 遍历需要翻译的元素
  translateElements.forEach(({ elements, tag }) => {
    elements.forEach((it) => {
      // 发送翻译请求
      chrome.runtime.sendMessage({ text: it.innerText }, (resp) => {
        // 插入翻译后的文本到元素中
        injectToNode(it, tag, resp.text)
      })
    })
  })
})

// 仅当DOM加载完成时
// TODO 目前 plasmo 不支持设置 run_at: document_start
// window.addEventListener("DOMContentLoaded", () => {
//   githubEditOnline()
//   console.log("DOM fully loaded and parsed")
// })

// 页面上所有的DOM,样式表,脚本,图片都已经加载完成时
window.onload = () => {
  // 优化浏览器自带的页面翻译，设置不自动翻译的元素
  setNotranslateNode()
}
