import {
  passTransClass,
  passTransNode,
  setNotranslateNode,
} from '~script/set-no-translate-node'

chrome.runtime.onMessage.addListener(() => {
  // 翻译所有的标签
  loopTransNode(document.body)
})

// 要过滤的标签
const passTransList = [
  'html',
  'head',
  'meta',
  'title',
  'body',
  'script',
  'style',
  'link',
  'code',
].concat(passTransNode)

// 过滤标签
const filterTagsFn = (tag) => {
  if (tag?.nodeType === 3) return tag
  // 过滤掉在过滤标签中的标签
  if (
    tag?.nodeType === 1 &&
    !passTransList.includes(tag?.tagName?.toLowerCase()) &&
    [...tag?.classList].every((item) => !passTransClass.includes(item))
  ) {
    return tag
  }
}

// 递归处理所有的标签
function loopTransNode(element) {
  // 当子元素为空时，中断
  if (element.childNodes.length === 0) return
  // 获取所有的子节点
  const childrenList = Array.from(element?.childNodes, filterTagsFn)
  // 遍历所有的子节点,  需要翻译的元素
  childrenList.forEach((tag) => {
    // 如果是文本节点，且不为空时，发送翻译请求
    if (tag?.nodeType === 3 && tag.textContent.trim() !== '') {
      // 发送翻译请求
      chrome.runtime.sendMessage({ text: tag.textContent }, (res) => {
        // 插入翻译后的文本到元素中
        tag.textContent += `${res.text}`
      })
    } else {
      tag && loopTransNode(tag)
    }
  })
}

// 页面上所有的DOM,样式表,脚本,图片都已经加载完成时
window.onload = () => {
  // 优化浏览器自带的页面翻译，设置不自动翻译的元素
  setNotranslateNode()
}
// 仅当DOM加载完成时
// TODO 目前 plasmo 貌似不支持注入的 run_at: document_start
// window.addEventListener("DOMContentLoaded", () => {
//   githubEditOnline()
//   console.log("DOM fully loaded and parsed")
// })
