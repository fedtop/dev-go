/**
 * 解除网站对复制、剪切、文本选择、右键菜单的限制。
 *
 * 只在用户为当前站点手动开启后生效（见 settings.unlockHosts）：
 * 阻断事件会让在线文档 / 代码编辑器等依赖 copy 事件写剪贴板的网站失灵，不能全局启用。
 */
import { unlockHosts } from '@/utils/settings'

/** 站点常用来禁止复制 / 选择 / 右键的事件 */
const BLOCKED_EVENTS = ['copy', 'cut', 'selectstart', 'contextmenu']

const STYLE_ID = 'devgo-unlock-style'

/** 恢复文本选择；只覆盖常见文本容器（用 * 会影响部分站点的拖拽、按钮等交互） */
const UNLOCK_CSS = `
:where(body, div, p, span, a, ul, ol, li, h1, h2, h3, h4, h5, h6, pre, code, td, th,
  article, section, header, footer, aside, nav, main, blockquote) {
  -webkit-user-select: text !important;
  user-select: text !important;
}`

/** 捕获阶段在 window 上阻断传播，抢在站点注册的监听之前；不调用 preventDefault，保留浏览器默认行为 */
function unblock(event: Event) {
  event.stopImmediatePropagation()
}

function enable() {
  BLOCKED_EVENTS.forEach((type) => window.addEventListener(type, unblock, { capture: true }))
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = UNLOCK_CSS
  ;(document.head ?? document.documentElement).append(style)
}

function disable() {
  BLOCKED_EVENTS.forEach((type) => window.removeEventListener(type, unblock, { capture: true }))
  document.getElementById(STYLE_ID)?.remove()
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main() {
    const host = location.hostname
    if (!host) return

    let active = false
    const apply = (hosts: string[]) => {
      const next = hosts.includes(host)
      if (next === active) return
      active = next
      if (active) enable()
      else disable()
    }

    apply(await unlockHosts.getValue())
    unlockHosts.watch(apply)
  },
})
