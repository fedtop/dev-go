/**
 * 悬停翻译：鼠标所在段落按需翻译，再次触发恢复原文。
 *
 * - 修饰键模式：按下（或轻点）修饰键翻译鼠标下的段落；按住不放移动鼠标可连续翻译。
 *   按下后短时间内又按了其他键（Ctrl+C、Alt+1 等组合键）则视为快捷键，不触发翻译。
 * - 停留模式：鼠标在段落上停留一段时间后自动翻译。
 */

import type { HoverTranslateMode } from '@/utils/settings'

import { WRAPPER_TAG } from './constants'
import { isBlankText, isEditable, LayoutProbe } from './dom'

type ModifierMode = Exclude<HoverTranslateMode, 'off' | 'dwell'>

const MODIFIERS: Record<ModifierMode, { key: string; flag: 'altKey' | 'ctrlKey' | 'shiftKey' }> = {
  alt: { key: 'Alt', flag: 'altKey' },
  ctrl: { key: 'Control', flag: 'ctrlKey' },
  shift: { key: 'Shift', flag: 'shiftKey' },
}

/** 修饰键按下后等待该时长确认不是组合键 */
const COMBO_GUARD_MS = 160
const DWELL_MS = 700
const MAX_ANCESTOR_LEVELS = 6
const MAX_HOST_TEXT_LENGTH = 5000

export interface HoverTarget {
  /** 触发翻译；allowRemove=false 时已翻译的段落保持不变 */
  toggle: (element: Element, allowRemove: boolean) => void
}

function hasDirectText(element: Element): boolean {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && !isBlankText(node.textContent),
  )
}

/** 鼠标下的元素 → 要翻译的段落宿主（最近的块级祖先） */
export function resolveHoverHost(element: Element | null): Element | null {
  if (!element?.isConnected) return null

  const wrapper = element.closest(WRAPPER_TAG)
  if (wrapper) return wrapper
  if (isEditable(element) || element.closest('devgo-selection-ui, devgo-toast')) return null

  let textOwner: Element | null = null
  for (let node: Element | null = element, depth = 0; node && depth < 3; depth += 1) {
    if (hasDirectText(node)) {
      textOwner = node
      break
    }
    node = node.parentElement
  }
  if (!textOwner) return null

  const probe = new LayoutProbe()
  let host: Element = textOwner
  for (let node: Element | null = textOwner, depth = 0; node && depth < MAX_ANCESTOR_LEVELS;) {
    if (node === document.body) break
    if (probe.isBlockLevel(node)) {
      host = node
      break
    }
    node = node.parentElement
    depth += 1
  }

  return (host.textContent?.length ?? 0) > MAX_HOST_TEXT_LENGTH ? null : host
}

export class HoverTranslator {
  private mode: HoverTranslateMode = 'off'
  private hovered: Element | null = null
  private armTimer: number | null = null
  private dwellTimer: number | null = null
  private dwellHost: Element | null = null
  private holding = false
  private lastHost: Element | null = null

  constructor(private readonly target: HoverTarget) {}

  setMode(mode: HoverTranslateMode) {
    if (mode === this.mode) return
    this.detach()
    this.mode = mode
    if (mode !== 'off') this.attach()
  }

  destroy() {
    this.detach()
    this.mode = 'off'
  }

  private attach() {
    document.addEventListener('mouseover', this.onMouseOver, { capture: true, passive: true })
    document.addEventListener('keydown', this.onKeyDown, true)
    document.addEventListener('keyup', this.onKeyUp, true)
    window.addEventListener('blur', this.reset)
  }

  private detach() {
    document.removeEventListener('mouseover', this.onMouseOver, { capture: true })
    document.removeEventListener('keydown', this.onKeyDown, true)
    document.removeEventListener('keyup', this.onKeyUp, true)
    window.removeEventListener('blur', this.reset)
    this.reset()
    this.hovered = null
  }

  private readonly reset = () => {
    if (this.armTimer) window.clearTimeout(this.armTimer)
    if (this.dwellTimer) window.clearTimeout(this.dwellTimer)
    this.armTimer = null
    this.dwellTimer = null
    this.dwellHost = null
    this.holding = false
    this.lastHost = null
  }

  private trigger(element: Element | null, allowRemove: boolean) {
    const host = resolveHoverHost(element)
    if (!host) return
    this.lastHost = host
    this.target.toggle(host, allowRemove)
  }

  private readonly onMouseOver = (event: MouseEvent) => {
    const element = event.composedPath()[0]
    if (!(element instanceof Element)) return
    this.hovered = element

    if (this.mode === 'dwell') {
      const host = resolveHoverHost(element)
      if (host === this.dwellHost) return
      if (this.dwellTimer) window.clearTimeout(this.dwellTimer)
      this.dwellHost = host
      this.dwellTimer = host
        ? window.setTimeout(() => {
            this.dwellTimer = null
            if (this.hovered && host.contains(this.hovered)) this.target.toggle(host, false)
          }, DWELL_MS)
        : null
      return
    }

    // 按住修饰键扫过新段落：只翻译，不移除
    if (this.mode !== 'off' && this.holding && event[MODIFIERS[this.mode].flag]) {
      const host = resolveHoverHost(element)
      if (host && host !== this.lastHost) {
        this.lastHost = host
        this.target.toggle(host, false)
      }
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.mode === 'off' || this.mode === 'dwell') return
    const { key } = MODIFIERS[this.mode]

    if (event.key !== key) {
      // 组合键：取消待触发的翻译
      if (this.armTimer) window.clearTimeout(this.armTimer)
      this.armTimer = null
      this.holding = false
      return
    }

    if (event.repeat || this.armTimer || this.holding) return
    this.armTimer = window.setTimeout(() => {
      this.armTimer = null
      this.holding = true
      this.trigger(this.hovered, true)
    }, COMBO_GUARD_MS)
  }

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (this.mode === 'off' || this.mode === 'dwell') return
    // 轻点修饰键：保留待触发的计时器，让「点一下」也能翻译
    if (event.key === MODIFIERS[this.mode].key) {
      this.holding = false
      this.lastHost = null
    }
  }
}
