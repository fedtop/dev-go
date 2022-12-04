import type {PlasmoContentScript} from 'plasmo'

import {passTransClass, passTransNode, setNotranslateNode} from '~script/set-no-translate-node'

export const config: PlasmoContentScript = {
  matches: ['<all_urls>'],
  run_at: 'document_start',
}

interface TranslateElements {
  elements: NodeListOf<HTMLElement>
  tag: keyof HTMLElementTagNameMap
}

chrome.runtime.onMessage.addListener((message, sender, res) => {
  const { type } = message
  console.log('🚀🚀🚀 / type', type)
  switch (type) {
    case 'translate-inline':
      // 翻译所有的标签
      loopTransNode(document.body)
      break
    case 'translate-paragraph':
      paragraphTrans()
      break
    default:
      break
  }
  console.log('🚀🚀🚀 / 测试连接性')
  // 测试连接性
  testConnection()
})

// 测试连接性
function testConnection() {
  chrome.runtime.sendMessage({ type: 'test' }, (res) => {
    if (!res) {
      alert('连接失败！Google翻译服务需要翻墙，请检查你的网络。')
    }
  })
}

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
// 要过滤的 class 名
const passTransClassList = ['translated', ...passTransClass]

// 过滤标签
const filterTagsFn = (tag) => {
  if (tag?.nodeType === 3) return tag
  // 过滤掉在过滤标签中的标签
  if (
    tag?.nodeType === 1 &&
    !passTransList.includes(tag?.tagName?.toLowerCase()) &&
    [...tag?.classList].every((item) => !passTransClassList.includes(item))
  ) {
    return tag
  }
}

// 递归处理所有的标签
function loopTransNode(element) {
  // 当子元素为空时，中断
  if (element.childNodes.length === 0) return

  // 获取所有的子节点
  const childrenList = Array.from(element?.childNodes, filterTagsFn).filter((item) => item)

  // 存储需要翻译的文本
  let translateText = ''
  let lastElement: HTMLElement = null

  // 遍历所有的子节点,  需要翻译的元素
  childrenList.forEach((tag) => {
    // 如果是文本节点，且不为空时，发送翻译请求
    if (tag?.nodeType === 3 && tag.textContent.trim() !== '') {
      // 如果文本中全是中文或空，不翻译
      if (!tag.textContent || /^[\u4e00-\u9fa5]+$/.test(tag.textContent)) return
      // 发送翻译请求
      chrome.runtime.sendMessage({ text: tag.textContent, type: 'translate' }, (res) => {
        insertTransResult(tag, res.text)
      })
    } else {
      tag && loopTransNode(tag)
    }

    // if (hasTransTextNode(tag)) {
    //   // 不需要翻译的元素
    //   if (!hasTranslate(tag.textContent)) return;
    //
    //   // 拼接需要翻译的文本
    //   translateText += tag.textContent
    //   lastElement = tag
    // } else {
    //   // 进入到这里证明一个段落已经结束，开始翻译
    //   sentenceTrans(translateText, lastElement)
    //   translateText = ''
    //   lastElement = null
    //
    //   // 递归处理非内联元素或者文本节点
    //   loopTransNode(tag)
    // }
  })

  // 最后一个段落的翻译
  sentenceTrans(translateText, lastElement)
  translateText = ''
  lastElement = null
}

// 判断节点是否是段落
function hasTransTextNode(element: HTMLElement) {
  if (element == null) return false;

  // 如果是文本节点，直接返回
  if (element.nodeType === 3) {
    return true;
  }

  // 换行元素过滤掉
  const lineBreakList = ['BR', 'HR'];
  if (lineBreakList.includes(element.tagName)) {
    return false;
  }

  // display 属性为 inline/inline-block 的元素是符合条件的
  const {display} = window.getComputedStyle(element);
  if (display === 'inline' || display === 'inline-block') {
    return true;
  }

  return false;
}

// 判断是否需要翻译，只检测中文
function hasTranslate(str: string) {
  if (!str) return false

  return !/[\u4e00-\u9fa5]/.test(str)
}

// 发送翻译请求
function sentenceTrans(text: string, insetBefore: HTMLElement) {
  if (text.trim() === '') return

  chrome.runtime.sendMessage({ text: text.replace(/[\r\n]/g, ''), type: 'translate' }, (res) => {
    insertTransResult(insetBefore, res.text)
  })
}

// 段落对比翻译
function paragraphTrans() {
  // 需要翻译的元素
  const translateElements: TranslateElements[] = [
    {
      elements: document.querySelectorAll(
        'h1:not(.translated),h2:not(.translated),h3:not(.translated),h4:not(.translated),h5:not(.translated),h6:not(.translated)',
      ),
      tag: 'p',
    },
    {
      elements: document.querySelectorAll('p:not(.translated)'),
      tag: 'p',
    },
    {
      elements: document.querySelectorAll('li:not(.translated)'),
      tag: 'li',
    },
  ]

  // 遍历需要翻译的元素
  translateElements.forEach(({elements, tag}) => {
    // 遍历所有的元素
    elements.forEach((item) => {
      // 给所有的元素添加翻译标识
      item.classList.add('translated')
      // // 如果文本中全是中文或空，不翻译
      // if (!item.innerText || /^[\u4e00-\u9fa5]+$/.test(item.innerText)) return
      // 发送翻译请求
      chrome.runtime.sendMessage({text: item.innerText, type: 'translate'}, (res) => {
        // 插入翻译后的文本到元素中
        insertTransResult(item, res.text, tag)
      })
    })
  })
}

// 插入翻译结果
export function insertTransResult(node: HTMLElement, transResult: string, resultTag?: string) {
  // 如何返回值中不包含中文或者为空时候，不插入到页面中
  if (!transResult || !/[\u4e00-\u9fa5]/.test(transResult)) return
  // 如果本文开头包含中文标点符号，去除
  transResult = transResult.replace(/^[，。？！：；、]/, '')
  // 插入翻译后的文本到元素中
  const transNode = document.createElement(resultTag || 'font')
  transNode.className = 'translated'
  transNode.style.cssText = `
    color:red;
    padding: 0 4px;
    font-size: 14px;
  `
  transNode.innerText = transResult
  node.parentNode?.insertBefore(transNode, node.nextSibling)
  const parent = node.parentNode as HTMLElement
  if (parent?.nodeType === 1) {
    parent?.classList.add('translated')
  }
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
