/**
 * 选区读取与替换：普通网页文字、输入框（input / textarea）与可编辑区域（contenteditable）。
 */

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** 选中文字所在的可编辑目标（写作类动作替换原文时用） */
export type EditableTarget =
  | { kind: 'input'; element: HTMLInputElement | HTMLTextAreaElement; start: number; end: number }
  | { kind: 'rich'; root: HTMLElement; range: Range }

export interface SelectionSnapshot {
  text: string
  rect: Rect
  editable: EditableTarget | null
  /** 选区所在段落（已截断），给 AI 提供上下文 */
  paragraph: string
}

const PARAGRAPH_CONTEXT_CHARS = 1200
const BLOCK_SELECTOR = 'p,li,td,th,dd,dt,blockquote,pre,h1,h2,h3,h4,h5,h6,section,article,div'
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', ''])

/** 穿透 shadow root 找到真正获得焦点的元素 */
function deepActiveElement(): Element | null {
  let active = document.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

function isTextField(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) return true
  return element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type)
}

function toRect(rect: DOMRect): Rect {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
}

/** 选区周围的段落文字：取最近的块级祖先，过长时以选区为中心截取 */
function paragraphAround(range: Range, selected: string): string {
  const node = range.commonAncestorContainer
  const element = node instanceof Element ? node : node.parentElement
  const block = element?.closest(BLOCK_SELECTOR)
  const text = (block?.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!text || text === selected) return ''
  if (text.length <= PARAGRAPH_CONTEXT_CHARS) return text

  const at = Math.max(0, text.indexOf(selected.slice(0, 50)))
  const start = Math.max(0, at - PARAGRAPH_CONTEXT_CHARS / 2)
  return `…${text.slice(start, start + PARAGRAPH_CONTEXT_CHARS)}…`
}

/**
 * 读取当前选区。输入框内的选区拿不到文字矩形，用鼠标抬起位置作为锚点。
 * @param pointer 鼠标抬起位置
 */
export function readSelection(pointer: { x: number; y: number }): SelectionSnapshot | null {
  const active = deepActiveElement()
  if (isTextField(active)) {
    const start = active.selectionStart ?? 0
    const end = active.selectionEnd ?? 0
    const text = active.value.slice(start, end)
    if (!text.trim() || active.readOnly || active.disabled) return null
    return {
      text,
      rect: { left: pointer.x, right: pointer.x, top: pointer.y - 8, bottom: pointer.y + 8 },
      editable: { kind: 'input', element: active, start, end },
      paragraph: '',
    }
  }

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null
  const text = selection.toString()
  if (!text.trim()) return null

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) return null

  const anchor = selection.anchorNode
  const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement
  const root = anchorElement?.closest<HTMLElement>('[contenteditable=""],[contenteditable="true"]')
  return {
    text,
    rect: toRect(rect),
    editable: root?.isContentEditable ? { kind: 'rich', root, range: range.cloneRange() } : null,
    paragraph: root ? '' : paragraphAround(range, text.trim()),
  }
}

/**
 * 用新文字替换原选区。优先用 execCommand('insertText')：保留撤销记录，
 * 也能让 React / Vue 等框架感知到输入；不支持时退回直接改写。
 */
export function replaceSelection(target: EditableTarget, text: string): boolean {
  if (target.kind === 'input') {
    const { element, start, end } = target
    if (!element.isConnected) return false
    element.focus()
    element.setSelectionRange(start, end)
    if (!document.execCommand('insertText', false, text)) {
      element.setRangeText(text, start, end, 'end')
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return true
  }

  const { root, range } = target
  if (!root.isConnected) return false
  root.focus()
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  if (!document.execCommand('insertText', false, text)) {
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    root.dispatchEvent(new Event('input', { bubbles: true }))
  }
  return true
}
