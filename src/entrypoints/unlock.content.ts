/**
 * 清除部分网站对用户行为（复制、剪切、文本选择）的限制。
 */

// 阻断站点注册的拦截监听
const eventList = ['copy', 'cut']

function unblock(e: Event) {
  e.stopPropagation()
  e.stopImmediatePropagation?.()
}

// 需要恢复文本选择能力的元素（不能用 *，会导致部分网站无法正常 copy）
const SELECTABLE_SELECTOR =
  'div,p,span,a,ul,li,ol,h1,h2,h3,h4,article,section,header,footer,aside,nav,main'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  main() {
    // 捕获阶段拦截，抢在站点监听之前阻止其冒泡
    eventList.forEach((event) => {
      document.documentElement.addEventListener(event, unblock, { capture: true })
    })

    // 放开被站点禁用的文本选择
    document.querySelectorAll<HTMLElement>(SELECTABLE_SELECTOR).forEach((element) => {
      if (window.getComputedStyle(element).userSelect === 'none') {
        // 注意：加 important 会导致部分网页白屏，这里不加
        element.style.setProperty('user-select', 'text')
      }
    })
  },
})
