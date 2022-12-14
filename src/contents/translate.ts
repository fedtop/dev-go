import type { PlasmoContentScript } from 'plasmo'

import { passTransClass, passTransNode, setNotranslateNode } from '~script/set-no-translate-node'

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
  console.log('ððð / type', type)
  switch (type) {
    case 'translate-inline':
      // æµè¯è¿æ¥æ§
      testConnection()
      // ç¿»è¯ææçæ ç­¾
      loopTransNode(document.body)
      break
    case 'translate-paragraph':
      // æµè¯è¿æ¥æ§
      testConnection()
      paragraphTrans()
      break
    default:
      break
  }
})

// æµè¯è¿æ¥æ§
function testConnection() {
  chrome.runtime.sendMessage({ type: 'test' }, (res) => {
    if (!res) {
      alert('Googleç¿»è¯æå¡ä¸ç¨³å®ï¼è¯·æ£æ¥æ¨çç½ç»ï¼å¤§éçæåéè¦ç¿»å¢ã')
    }
  })
}

// è¦è¿æ»¤çæ ç­¾
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
// è¦è¿æ»¤ç class å
const passTransClassList = ['translated', ...passTransClass]

// è¿æ»¤æ ç­¾
function filterTagsFn(tag): HTMLElement | null {
  if (tag?.nodeType === 3) return tag
  // è¿æ»¤æå¨è¿æ»¤æ ç­¾ä¸­çæ ç­¾
  if (
    tag?.nodeType === 1 &&
    !passTransList.includes(tag?.tagName?.toLowerCase()) &&
    [...tag?.classList].every((item) => !passTransClassList.includes(item))
  ) {
    return tag
  }
  return null
}

// éå½å¤çææçæ ç­¾
function loopTransNode(element) {
  // å½å­åç´ ä¸ºç©ºæ¶ï¼ä¸­æ­
  if (element.childNodes.length === 0) return

  // è·åææçå­èç¹
  const childrenList = Array.from(element?.childNodes, filterTagsFn).filter((item) => item)

  // å­å¨éè¦ç¿»è¯çææ¬
  let translateText = ''
  let lastElement: HTMLElement = null

  // éåææçå­èç¹,  éè¦ç¿»è¯çåç´ 
  childrenList.forEach((tag) => {
    if (hasTransTextNode(tag)) {
      // ä¸éè¦ç¿»è¯çåç´ 
      if (!hasTranslate(tag.textContent)) return

      // æ¼æ¥éè¦ç¿»è¯çææ¬
      translateText += tag.textContent
      lastElement = tag
    } else {
      // è¿å¥å°è¿éè¯æä¸ä¸ªæ®µè½å·²ç»ç»æï¼å¼å§ç¿»è¯
      sentenceTrans(translateText, lastElement)
      translateText = ''
      lastElement = null

      // éå½å¤çéåèåç´ æèææ¬èç¹
      loopTransNode(tag)
    }
  })

  // æåä¸ä¸ªæ®µè½çç¿»è¯
  sentenceTrans(translateText, lastElement)
}

// å¤æ­èç¹æ¯å¦æ¯æ®µè½
function hasTransTextNode(element: HTMLElement) {
  if (element == null) return false

  // å¦ææ¯ææ¬èç¹ï¼ç´æ¥è¿å
  if (element.nodeType === 3) {
    return true
  }

  // æ¢è¡åç´ è¿æ»¤æ
  const lineBreakList = ['BR', 'HR']
  if (lineBreakList.includes(element.tagName)) {
    return false
  }

  // display å±æ§ä¸º inline/inline-block çåç´ æ¯ç¬¦åæ¡ä»¶ç
  const { display } = window.getComputedStyle(element)
  if (display === 'inline' || display === 'inline-block') {
    return true
  }

  return false
}

// å¤æ­æ¯å¦éè¦ç¿»è¯ï¼åªæ£æµä¸­æ
function hasTranslate(str: string) {
  if (!str) return false

  return !/[\u4e00-\u9fa5]/.test(str)
}

// åéç¿»è¯è¯·æ±
function sentenceTrans(text: string, insetBefore: HTMLElement) {
  if (text.trim() === '') return

  chrome.runtime.sendMessage({ text: text.replace(/[\r\n]/g, ''), type: 'translate' }, (res) => {
    insertTransResult(insetBefore, res.text)
  })
}

// æ®µè½å¯¹æ¯ç¿»è¯
function paragraphTrans() {
  // éè¦ç¿»è¯çåç´ 
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

  // éåéè¦ç¿»è¯çåç´ 
  translateElements.forEach(({ elements, tag }) => {
    // éåææçåç´ 
    elements.forEach((item) => {
      // ç»ææçåç´ æ·»å ç¿»è¯æ è¯
      item.classList.add('translated')
      // // å¦æææ¬ä¸­å¨æ¯ä¸­ææç©ºï¼ä¸ç¿»è¯
      // if (!item.innerText || /^[\u4e00-\u9fa5]+$/.test(item.innerText)) return
      // åéç¿»è¯è¯·æ±
      chrome.runtime.sendMessage({ text: item.innerText, type: 'translate' }, (res) => {
        // æå¥ç¿»è¯åçææ¬å°åç´ ä¸­
        insertTransResult(item, res.text, tag)
      })
    })
  })
}

// æå¥ç¿»è¯ç»æ
export function insertTransResult(node: HTMLElement, transResult: string, resultTag?: string) {
  // å¦ä½è¿åå¼ä¸­ä¸åå«ä¸­ææèä¸ºç©ºæ¶åï¼ä¸æå¥å°é¡µé¢ä¸­
  if (!transResult || !/[\u4e00-\u9fa5]/.test(transResult)) return
  // å¦ææ¬æå¼å¤´åå«ä¸­ææ ç¹ç¬¦å·ï¼å»é¤
  const text = transResult.replace(/^[ï¼ãï¼ï¼ï¼ï¼ã]/, '')
  // æå¥ç¿»è¯åçææ¬å°åç´ ä¸­
  const transNode = document.createElement(resultTag || 'font')
  transNode.className = 'translated'
  transNode.style.cssText = `
    color:red;
    padding: 0 4px;
    font-size: 14px;
  `
  transNode.innerText = text
  node.parentNode?.insertBefore(transNode, node.nextSibling)
  const parent = node.parentNode as HTMLElement
  if (parent?.nodeType === 1) {
    parent?.classList.add('translated')
  }
}

// // é¡µé¢ä¸ææçDOM,æ ·å¼è¡¨,èæ¬,å¾çé½å·²ç»å è½½å®ææ¶
// window.onload = () => {
//   // ä¼åæµè§å¨èªå¸¦çé¡µé¢ç¿»è¯ï¼è®¾ç½®ä¸èªå¨ç¿»è¯çåç´ 
//   setNotranslateNode()
// }

// ä»å½DOMå è½½å®ææ¶
window.addEventListener('DOMContentLoaded', () => {
  setNotranslateNode()
})
