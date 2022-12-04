import type { PlasmoContentScript } from 'plasmo'

export const config: PlasmoContentScript = {
  matches: ['<all_urls>'],
  run_at: 'document_end',
}

window.addEventListener('DOMContentLoaded', () => {
  eventOpen()
})

const eventList = [
  'copy',
  'cut',
  // 'contextmenu',
  // 'selectstart',
  // 'mousedown',
  // 'mouseup',
  // 'mousemove',
  // 'keydown',
  // 'keypress',
  // 'keyup',
]

function t(e) {
  e.stopPropagation()
  e.stopImmediatePropagation && e.stopImmediatePropagation()
}
// 清除网站中被开发者限制的用户行为
export default function eventOpen() {
  eventList.forEach((event) => {
    document.documentElement.addEventListener(event, t, { capture: !0 })
  })
}

document
  .querySelectorAll(
    // 不能用*,会导致部分网站无法正常copy
    'div,p,span,a,ul,li,ol,h1,h2,h3,h4,article,section,header,footer,aside,nav,main,a',
  )
  .forEach((element: HTMLElement) => {
    if (window.getComputedStyle(element, null).getPropertyValue('user-select')) {
      // TODO，+ important 会导致部分网页白屏
      // element.style.setProperty('user-select', 'text', 'important')
      element.style.setProperty('user-select', 'text')
    }
  })
