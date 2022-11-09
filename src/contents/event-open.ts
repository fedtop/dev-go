import type { PlasmoContentScript } from 'plasmo'

export const config: PlasmoContentScript = {
  matches: ['<all_urls>'],
  run_at: 'document_start',
}

window.addEventListener('DOMContentLoaded', () => {
  eventOpen()
})

document.querySelectorAll('*').forEach((element: HTMLElement) => {
  'none' ===
    window.getComputedStyle(element, null).getPropertyValue('user-select') &&
    element.style.setProperty('user-select', 'text', 'important')
})

let eventList = [
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
  e.stopPropagation(),
    e.stopImmediatePropagation && e.stopImmediatePropagation()
}
// 清除网站中被开发者限制的用户行为
export default function eventOpen() {
  eventList.forEach((event) => {
    document.documentElement.addEventListener(event, t, { capture: !0 })
  })
}
