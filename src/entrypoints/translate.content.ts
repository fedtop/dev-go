import { setNotranslateNode } from '@/utils/no-translate'
import { sendRuntimeMessage, type TabMessage } from '@/utils/messaging'

// DevGo 专属标记：避免与网站自带的 class 冲突
const TRANS_NODE_CLASS = 'devgo-translation' // 插入的译文节点
const TRANSLATED_CLASS = 'devgo-translated' // 已翻译的原节点标记

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    // 监听来自 Background / Popup 的指令
    browser.runtime.onMessage.addListener((message: TabMessage) => {
      switch (message?.type) {
        case 'translate-page':
          // 已翻译则再次点击移除，恢复原样（toggle）
          if (removeTranslations()) break
          testConnection()
          paragraphTrans()
          break
        case 'tip':
          // eslint-disable-next-line no-alert
          alert(message.msg)
          break
        default:
          break
      }
    })

    // DOM 就绪后，标记浏览器自带翻译需要忽略的元素
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', setNotranslateNode)
    } else {
      setNotranslateNode()
    }
  },
})

// 测试连通性
async function testConnection() {
  const ok = await sendRuntimeMessage({ type: 'test' })
  if (!ok) {
    // eslint-disable-next-line no-alert
    alert('翻译服务不稳定！请检查网络，或在弹窗里切换翻译引擎。')
  }
}

// 移除页面上所有 DevGo 译文，恢复原样；有移除则返回 true
function removeTranslations(): boolean {
  const transNodes = document.querySelectorAll(`.${TRANS_NODE_CLASS}`)
  if (transNodes.length === 0) return false

  transNodes.forEach((node) => node.remove())
  document
    .querySelectorAll(`.${TRANSLATED_CLASS}`)
    .forEach((el) => el.classList.remove(TRANSLATED_CLASS))
  return true
}

// 整页对比翻译：翻译标题 / 段落 / 列表项，在其后插入译文
function paragraphTrans() {
  const sel = `:not(.${TRANSLATED_CLASS})`
  const selectors = [
    `h1${sel}`,
    `h2${sel}`,
    `h3${sel}`,
    `h4${sel}`,
    `h5${sel}`,
    `h6${sel}`,
    `p${sel}`,
    `li${sel}`,
  ].join(',')

  document.querySelectorAll<HTMLElement>(selectors).forEach((item) => {
    const text = item.innerText.trim()
    if (!text) return

    item.classList.add(TRANSLATED_CLASS)
    // 发送带标签的 HTML，让译文保留 a/b 等内联标签（颜色、下划线等）
    sendRuntimeMessage({ type: 'translate', text: item.innerHTML, html: true }).then((res) => {
      insertTransResult(item, res.text)
    })
  })
}

// 插入译文：克隆原元素，保留其标签 / class / 颜色 / 字号等样式，仅替换文字，
// 使译文与原文外观一致（参考沉浸式翻译的对照阅读体验）
export function insertTransResult(node: HTMLElement, transResult: string) {
  // 返回值不含中文或为空时不插入
  if (!transResult || !/[\u4e00-\u9fa5]/.test(transResult)) return

  // 去掉开头多余的中文标点
  const text = transResult.replace(/^[，。？！：；、]/, '')

  // 克隆原节点（不含子节点）-> 继承同标签、同 class、同颜色、同字号
  const clone = node.cloneNode(false) as HTMLElement
  clone.removeAttribute('id')
  clone.classList.add(TRANS_NODE_CLASS)
  // 用 innerHTML 注入，保留译文中的 a/b 等内联标签（颜色、下划线等）
  clone.innerHTML = text
  // 与原文留出一点间距，便于对照阅读
  clone.style.marginTop = '2px'

  node.insertAdjacentElement('afterend', clone)
}
