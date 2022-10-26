import { injectToNode } from "~script/injector"

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
