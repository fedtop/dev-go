/**
 * 页面内轻量提示条（Shadow DOM 隔离样式），用于翻译出错、配置缺失等提示。
 */

const HOST_TAG = 'devgo-toast'
const DISPLAY_MS = 6000

export interface ToastOptions {
  message: string
  actionLabel?: string
  onAction?: () => void
}

let current: { host: HTMLElement; timer: number } | null = null

const STYLES = `
:host { all: initial; }
.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(420px, calc(100vw - 40px));
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(17, 24, 39, 0.94);
  color: #f9fafb;
  font: 13px/1.5 system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
  animation: enter 0.18s ease-out;
}
.brand { font-weight: 600; color: #a5b4fc; flex-shrink: 0; }
.message { flex: 1; word-break: break-word; }
button {
  all: unset;
  flex-shrink: 0;
  cursor: pointer;
  color: #a5b4fc;
  font-weight: 600;
}
button:hover { color: #c7d2fe; }
.close { color: #9ca3af; font-size: 15px; line-height: 1; }
@keyframes enter { from { opacity: 0; transform: translateY(6px); } }
`

export function hideToast() {
  if (!current) return
  window.clearTimeout(current.timer)
  current.host.remove()
  current = null
}

export function showToast({ message, actionLabel, onAction }: ToastOptions) {
  hideToast()

  const host = document.createElement(HOST_TAG)
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = STYLES

  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.setAttribute('role', 'status')

  const brand = document.createElement('span')
  brand.className = 'brand'
  brand.textContent = 'DevGo'

  const text = document.createElement('span')
  text.className = 'message'
  text.textContent = message

  toast.append(brand, text)

  if (actionLabel && onAction) {
    const action = document.createElement('button')
    action.type = 'button'
    action.textContent = actionLabel
    action.addEventListener('click', () => {
      onAction()
      hideToast()
    })
    toast.append(action)
  }

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'close'
  close.textContent = '✕'
  close.setAttribute('aria-label', '关闭')
  close.addEventListener('click', hideToast)
  toast.append(close)

  shadow.append(style, toast)
  document.documentElement.appendChild(host)
  current = { host, timer: window.setTimeout(hideToast, DISPLAY_MS) }
}
