/**
 * DOM / 布局探测工具。
 *
 * 段落切分依赖元素的计算样式（display）而非标签名，这样才能正确处理
 * 「用 div 写段落」「用 span 做块」「flex 子项被块级化」等真实网页写法。
 * LayoutProbe 在单次遍历内缓存 getComputedStyle 与「是否有块级后代」的结果。
 */

import { OWN_UI_SELECTOR } from './constants'

/** 视作块级（段落边界）的 display 值；另外所有 table* 也算 */
const BLOCK_DISPLAYS = new Set(['block', 'flow-root', 'grid', 'list-item', 'flex', '-webkit-box'])

/** 无论样式如何都视作结构元素（列表项天然分段） */
const STRUCTURAL_TAGS = new Set(['UL', 'OL', 'LI', 'MENU', 'DL', 'DT', 'DD'])

/** 公式容器：内部子元素多为排版用块，不应据此判断为「有块级后代」 */
const FORMULA_TAGS = new Set(['MATH', 'MJX-CONTAINER'])

const BLANK_RE = /^\s*$/

export function isBlankText(text: string | null | undefined): boolean {
  return BLANK_RE.test(text ?? '')
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 展示长度：中日韩及全角字符按 2 计 */
export function weightedLength(text: string): number {
  let length = 0
  for (const char of text) length += char.charCodeAt(0) > 0x2e7f ? 2 : 1
  return length
}

/** 移除 DevGo 添加的 class；若因此留下空的 class 属性则一并删除，保证还原后 DOM 与原来一致 */
export function removeOwnClass(element: Element, className: string) {
  element.classList.remove(className)
  if (!element.classList.length && element.getAttribute('class') === '') {
    element.removeAttribute('class')
  }
}

export function isOwnUi(node: Node): boolean {
  return node instanceof Element && node.matches(OWN_UI_SELECTOR)
}

export function isInsideOwnUi(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement
  return Boolean(element?.closest(OWN_UI_SELECTOR))
}

export function isEditable(element: Element | null): boolean {
  for (let node = element; node; node = node.parentElement) {
    if (node instanceof HTMLElement && node.isContentEditable) return true
    if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) return true
  }
  return false
}

/** 节点内是否有非空白文字（跳过 DevGo 自己的译文） */
export function hasText(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return !isBlankText(node.textContent)
  if (!(node instanceof Element) || isOwnUi(node)) return false
  if (isBlankText(node.textContent)) return false
  if (!node.querySelector(OWN_UI_SELECTOR)) return true

  for (const child of node.childNodes) if (hasText(child)) return true
  return false
}

/** 页面可见文字（剔除 DevGo 译文），用于判定段落内容 */
export function getVisibleText(nodes: Node[]): string {
  let text = ''
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
    } else if (node instanceof Element && !isOwnUi(node)) {
      text += node.querySelector(OWN_UI_SELECTOR)
        ? getVisibleText(Array.from(node.childNodes))
        : (node.textContent ?? '')
    }
  }
  return text
}

export class LayoutProbe {
  private displays = new WeakMap<Element, string>()
  private blockDescendants = new WeakMap<Element, boolean>()

  /** 页面发生变化后丢弃缓存的样式判断 */
  reset() {
    this.displays = new WeakMap()
    this.blockDescendants = new WeakMap()
  }

  display(element: Element): string {
    let display = this.displays.get(element)
    if (display === undefined) {
      display = getComputedStyle(element).display
      this.displays.set(element, display)
    }
    return display
  }

  /** 是否构成段落边界：块级 display、表格类、换行 br */
  isBlockLevel(element: Element): boolean {
    if (element.tagName === 'BR' || STRUCTURAL_TAGS.has(element.tagName)) return true
    const display = this.display(element)
    return BLOCK_DISPLAYS.has(display) || display.includes('table')
  }

  /** 行内参与文字流（inline / inline-block / inline-flex 等） */
  isInline(element: Element): boolean {
    return !this.isBlockLevel(element) && this.display(element) !== 'none'
  }

  /** 后代中是否存在块级元素：有则该元素是「容器」，需要继续向内切分 */
  hasBlockDescendant(element: Element): boolean {
    const cached = this.blockDescendants.get(element)
    if (cached !== undefined) return cached

    let result = false
    for (const child of element.children) {
      if (isOwnUi(child)) continue
      if (this.isBlockLevel(child)) {
        result = true
        break
      }
      if (
        !FORMULA_TAGS.has(child.tagName) &&
        child.children.length &&
        this.hasBlockDescendant(child)
      ) {
        result = true
        break
      }
    }

    this.blockDescendants.set(element, result)
    return result
  }
}

/** 段落元素若被祖先多行截断（-webkit-line-clamp），返回需要解除截断的祖先 */
export function findLineClampAncestor(element: Element | null): HTMLElement | null {
  let node = element
  for (let depth = 0; node && depth < 3; depth += 1, node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue
    const clamp = getComputedStyle(node).getPropertyValue('-webkit-line-clamp')
    if (clamp && clamp !== 'none') return node
  }
  return null
}
