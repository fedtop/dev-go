/**
 * 整页翻译引擎。
 *
 * 流程：切段（segmenter）→ 段落宿主进入视口（IntersectionObserver）→ 编码（codec）
 *      → 合批翻译（queue → 端口 → Background，按段流式返回）→ 解码并注入译文。
 * MutationObserver 负责增量：新增内容按「最近的未遍历祖先」切分，已翻译段落内容变化则重新切分宿主。
 *
 * 所有 DOM 写操作都包在 mute() 里：先收下页面自身的变更记录，再丢弃引擎自己产生的记录，
 * 避免「插入译文 → 触发监听 → 再次翻译」的循环。
 */

import { toTranslateError, type TranslateError } from '@/features/translate/errors'
import { isLikelyInTargetLang, type TranslateLangCode } from '@/features/translate/languages'
import type { TranslatePageContext } from '@/utils/messaging'
import type { TranslateDisplayMode } from '@/utils/settings'

import { decodeTranslation, encodeParagraph, isSameAsSource, type EncodedParagraph } from './codec'
import {
  BLOCK_LAYOUT_MIN_LENGTH,
  HIDDEN_ORIGINAL_CLASS,
  LOADING_TAG,
  RETRY_TAG,
  ROOT_TRANSLATION_ONLY_CLASS,
  ROOT_UNDERLINE_CLASS,
  TEXT_TAG,
  UNCLAMP_CLASS,
  WRAPPER_TAG,
} from './constants'
import {
  findLineClampAncestor,
  getVisibleText,
  isEditable,
  isInsideOwnUi,
  isOwnUi,
  LayoutProbe,
  normalizeWhitespace,
  removeOwnClass,
  weightedLength,
} from './dom'
import { TranslationQueue } from './queue'
import { TranslateRules } from './rules'
import { segmentChildren, segmentNode, type ParagraphGroup, type SegmentContext } from './segmenter'
import { injectTranslateStyle, removeTranslateStyle } from './style'
import { TranslatePortClient } from './transport'

type RecordState = 'idle' | 'loading' | 'done' | 'same' | 'error'
type RecordScope = 'page' | 'hover'

interface HiddenOriginal {
  node: Node
  /** 文本节点无法用 CSS 隐藏，替换为注释锚点，恢复时再换回 */
  anchor: Comment | null
}

interface ParagraphRecord {
  scope: RecordScope
  nodes: Node[]
  host: Element
  state: RecordState
  wrapper: HTMLElement | null
  encoded: EncodedParagraph | null
  hidden: HiddenOriginal[]
  unclamped: HTMLElement | null
}

export interface PageTranslatorOptions {
  /** 段落翻译失败（已取消的不回调），用于页面级提示 */
  onError?: (error: TranslateError) => void
}

const MAX_PARAGRAPH_LENGTH = 8000
const MUTATION_DELAY = 500
/** 同一宿主被页面反复改写（计时器、轮播等）超过该次数后不再跟随重译 */
const MAX_HOST_RETRANSLATIONS = 8
const INTERSECTION_MARGIN = '400px 0px 800px 0px'

/** 段落是否值得翻译：有足够文字、不是纯数字 / 符号 / 链接 */
function isTranslatableText(text: string): boolean {
  if (!text || text.length > MAX_PARAGRAPH_LENGTH) return false
  if (/^(https?:\/\/|www\.)\S+$/i.test(text)) return false

  const letters = text.match(/\p{L}/gu)?.length ?? 0
  if (letters === 0) return false
  const wide = text.match(
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
  )
  return (wide?.length ?? 0) > 0 || letters >= 2
}

export class PageTranslator {
  private readonly client = new TranslatePortClient()
  private readonly queue: TranslationQueue
  private readonly probe = new LayoutProbe()
  private rules = new TranslateRules(window.location.href, this.probe)
  private traversed = new WeakSet<Element>()
  private records = new Set<ParagraphRecord>()
  private memberRecords = new WeakMap<Node, ParagraphRecord>()
  private hostRecords = new WeakMap<Element, Set<ParagraphRecord>>()
  private hostChurn = new WeakMap<Element, number>()
  private intersection: IntersectionObserver | null = null
  private mutation: MutationObserver | null = null
  private readonly pendingMutations = new Set<Node>()
  private mutationTimer: number | null = null
  private target: TranslateLangCode = 'zh-CN'
  private displayMode: TranslateDisplayMode = 'bilingual'
  private underline = false
  private pageActive = false
  private generation = 0

  constructor(private readonly options: PageTranslatorOptions = {}) {
    this.queue = new TranslationQueue(this.client, () => this.getContext())
  }

  get isPageActive(): boolean {
    return this.pageActive
  }

  get targetLang(): TranslateLangCode {
    return this.target
  }

  /* ------------------------------ 对外 API ------------------------------ */

  /** 开始整页翻译（会先清理上一次的全部结果） */
  startPage(target: TranslateLangCode) {
    this.stopAll()
    this.target = target
    this.pageActive = true
    this.prepare()

    this.intersection = new IntersectionObserver((entries) => this.onIntersect(entries), {
      rootMargin: INTERSECTION_MARGIN,
    })

    const ctx = this.segmentContext()
    for (const root of this.resolveRoots()) {
      segmentChildren(root, ctx).forEach((group) => this.register(group, 'page'))
    }

    this.mutation = new MutationObserver((list) => this.collectMutations(list))
    this.mutation.observe(document.body, { childList: true, subtree: true, characterData: true })
  }

  /** 停止整页 / 悬停翻译，恢复页面原貌 */
  stopAll() {
    this.generation += 1
    this.pageActive = false
    this.queue.clear()
    this.intersection?.disconnect()
    this.intersection = null
    this.mutation?.disconnect()
    this.mutation = null
    this.pendingMutations.clear()
    if (this.mutationTimer) window.clearTimeout(this.mutationTimer)
    this.mutationTimer = null

    this.records.forEach((record) => this.removeRecord(record))
    this.records.clear()
    this.memberRecords = new WeakMap()
    this.hostRecords = new WeakMap()
    this.hostChurn = new WeakMap()
    this.traversed = new WeakSet()

    const root = document.documentElement
    removeOwnClass(root, ROOT_UNDERLINE_CLASS)
    removeOwnClass(root, ROOT_TRANSLATION_ONLY_CLASS)
    removeTranslateStyle()
  }

  /** 释放全部资源（内容脚本失效时） */
  destroy() {
    this.stopAll()
    this.client.dispose()
  }

  /** 切换目标语言；整页翻译进行中则重新翻译 */
  setTarget(target: TranslateLangCode) {
    if (target === this.target) return
    this.target = target
    if (this.pageActive) this.startPage(target)
  }

  /** 翻译引擎或其配置变更：丢弃缓存，进行中的翻译重新开始 */
  resetProvider() {
    this.queue.clearCache()
    if (this.pageActive) this.startPage(this.target)
  }

  setDisplayMode(mode: TranslateDisplayMode) {
    this.displayMode = mode
    if (!this.records.size) return
    this.applyRootClasses()
    this.mute(() => {
      this.records.forEach((record) => {
        if (record.state !== 'done') return
        if (mode === 'translation') this.hideOriginal(record)
        else this.showOriginal(record)
      })
    })
  }

  setUnderline(enabled: boolean) {
    this.underline = enabled
    if (this.records.size) this.applyRootClasses()
  }

  /**
   * 悬停翻译：翻译元素所在段落；allowRemove 时该处已有译文则移除（再次触发即恢复原文）。
   */
  toggleElement(element: Element, allowRemove = true): 'translated' | 'removed' | 'ignored' {
    if (isInsideOwnUi(element)) {
      if (!allowRemove) return 'ignored'
      const wrapper = element.closest(WRAPPER_TAG)
      const record = this.findRecordByWrapper(wrapper)
      if (!record) return 'ignored'
      this.mute(() => this.removeRecord(record))
      return 'removed'
    }

    if (isEditable(element) || this.rules.isInsideExcluded(element)) return 'ignored'

    const existing = [...this.records].filter(
      (record) =>
        record.state !== 'idle' &&
        (element.contains(record.host) ||
          record.nodes.some((node) => node === element || node.contains(element))),
    )
    if (existing.length) {
      if (!allowRemove) return 'ignored'
      this.mute(() => existing.forEach((record) => this.removeRecord(record)))
      return 'removed'
    }

    if (!this.records.size) this.prepare()
    const before = this.records.size
    segmentNode(element, this.segmentContext()).forEach((group) => this.register(group, 'hover'))
    return this.records.size > before ? 'translated' : 'ignored'
  }

  /* ------------------------------ 切段与登记 ------------------------------ */

  private prepare() {
    this.probe.reset()
    this.rules = new TranslateRules(window.location.href, this.probe)
    injectTranslateStyle(this.rules.styles)
    this.applyRootClasses()
  }

  private applyRootClasses() {
    const root = document.documentElement
    const toggle = (className: string, enabled: boolean) => {
      if (enabled) root.classList.add(className)
      else removeOwnClass(root, className)
    }
    toggle(ROOT_UNDERLINE_CLASS, this.underline)
    toggle(ROOT_TRANSLATION_ONLY_CLASS, this.displayMode === 'translation')
  }

  private segmentContext(): SegmentContext {
    return { rules: this.rules, probe: this.probe, traversed: this.traversed }
  }

  private resolveRoots(): Element[] {
    const selectors = this.rules.roots
    if (!selectors) return [document.body]
    const roots = Array.from(document.querySelectorAll(selectors.join(',')))
    return roots.filter((root) => !roots.some((other) => other !== root && other.contains(root)))
  }

  private getContext(): TranslatePageContext {
    return { title: document.title.slice(0, 200), host: window.location.hostname }
  }

  private register(group: ParagraphGroup, scope: RecordScope) {
    const text = normalizeWhitespace(getVisibleText(group.nodes))
    if (!isTranslatableText(text) || isLikelyInTargetLang(text, this.target)) return

    const record: ParagraphRecord = {
      scope,
      nodes: group.nodes,
      host: group.host,
      state: 'idle',
      wrapper: null,
      encoded: null,
      hidden: [],
      unclamped: null,
    }

    this.records.add(record)
    record.nodes.forEach((node) => this.memberRecords.set(node, record))
    const siblings = this.hostRecords.get(record.host) ?? new Set<ParagraphRecord>()
    siblings.add(record)
    this.hostRecords.set(record.host, siblings)

    if (scope === 'page' && this.intersection) this.intersection.observe(record.host)
    else void this.translateRecord(record)
  }

  private onIntersect(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      this.intersection?.unobserve(entry.target)
      this.hostRecords.get(entry.target)?.forEach((record) => {
        if (record.state === 'idle') void this.translateRecord(record)
      })
    }
  }

  /* -------------------------------- 翻译 -------------------------------- */

  private isLive(record: ParagraphRecord, generation: number): boolean {
    return generation === this.generation && this.records.has(record)
  }

  private async translateRecord(record: ParagraphRecord) {
    if (!this.records.has(record) || record.state === 'loading') return
    if (!record.nodes.some((node) => node.isConnected)) {
      this.dropRecord(record)
      return
    }

    const encoded = encodeParagraph(record.nodes, this.rules)
    if (!encoded.text) {
      this.dropRecord(record)
      return
    }

    record.encoded = encoded
    record.state = 'loading'
    this.mute(() => this.renderLoading(record))

    const generation = this.generation
    try {
      const translated = await this.queue.translate(encoded.text, this.target)
      if (!this.isLive(record, generation)) return
      this.mute(() => this.renderResult(record, encoded, translated))
    } catch (error) {
      if (!this.isLive(record, generation)) return
      const translateError = toTranslateError(error)
      if (translateError.code === 'aborted') {
        record.state = 'idle'
        return
      }
      this.mute(() => this.renderError(record, translateError))
      this.options.onError?.(translateError)
    }
  }

  /* -------------------------------- 渲染 -------------------------------- */

  private ensureWrapper(record: ParagraphRecord): HTMLElement | null {
    if (record.wrapper?.isConnected) return record.wrapper

    const last = [...record.nodes].reverse().find((node) => node.isConnected && node.parentNode)
    if (!last?.parentNode) return null

    const wrapper = document.createElement(WRAPPER_TAG)
    wrapper.setAttribute('translate', 'no')
    wrapper.classList.add('notranslate')
    last.parentNode.insertBefore(wrapper, last.nextSibling)
    record.wrapper = wrapper
    return wrapper
  }

  private findRecordByWrapper(wrapper: Element | null): ParagraphRecord | undefined {
    if (!wrapper) return undefined
    return [...this.records].find((record) => record.wrapper === wrapper)
  }

  private renderLoading(record: ParagraphRecord) {
    const wrapper = this.ensureWrapper(record)
    if (!wrapper) return
    wrapper.dataset.state = 'loading'
    delete wrapper.dataset.layout
    wrapper.replaceChildren(document.createElement(LOADING_TAG))
  }

  private renderResult(record: ParagraphRecord, encoded: EncodedParagraph, translated: string) {
    const wrapper = this.ensureWrapper(record)
    if (!wrapper) return

    const fragment = decodeTranslation(translated, encoded)
    const translatedText = fragment.textContent ?? ''
    if (!translatedText.trim() || isSameAsSource(encoded.text, translatedText)) {
      record.state = 'same'
      wrapper.dataset.state = 'same'
      wrapper.replaceChildren()
      return
    }

    const text = document.createElement(TEXT_TAG)
    text.appendChild(fragment)

    const sourceLength = weightedLength(normalizeWhitespace(getVisibleText(encoded.represented)))
    wrapper.dataset.state = 'done'
    wrapper.dataset.layout = sourceLength >= BLOCK_LAYOUT_MIN_LENGTH ? 'block' : 'inline'
    wrapper.replaceChildren(text)
    record.state = 'done'

    const clamped = findLineClampAncestor(record.host)
    if (clamped) {
      clamped.classList.add(UNCLAMP_CLASS)
      record.unclamped = clamped
    }

    if (this.displayMode === 'translation') this.hideOriginal(record)
  }

  private renderError(record: ParagraphRecord, error: TranslateError) {
    record.state = 'error'
    const wrapper = this.ensureWrapper(record)
    if (!wrapper) return

    const retry = document.createElement(RETRY_TAG)
    retry.textContent = '↻'
    retry.title = `翻译失败：${error.message}（点击重试）`
    retry.setAttribute('role', 'button')
    retry.tabIndex = 0

    const handleRetry = (event: Event) => {
      // 译文可能位于链接内，阻止点击触发页面跳转
      event.preventDefault()
      event.stopPropagation()
      record.state = 'idle'
      void this.translateRecord(record)
    }
    retry.addEventListener('click', handleRetry)
    retry.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') handleRetry(event)
    })

    wrapper.dataset.state = 'error'
    delete wrapper.dataset.layout
    wrapper.replaceChildren(retry)
  }

  private hideOriginal(record: ParagraphRecord) {
    if (record.hidden.length || !record.encoded || !record.wrapper) return

    for (const node of record.encoded.represented) {
      if (!node.isConnected) continue
      if (node instanceof Element) {
        node.classList.add(HIDDEN_ORIGINAL_CLASS)
        record.hidden.push({ node, anchor: null })
      } else {
        const anchor = document.createComment('devgo-original')
        node.parentNode?.replaceChild(anchor, node)
        record.hidden.push({ node, anchor })
      }
    }
    record.wrapper.toggleAttribute('data-detached', true)
  }

  private showOriginal(record: ParagraphRecord) {
    for (const { node, anchor } of record.hidden) {
      if (anchor) {
        if (anchor.parentNode) anchor.parentNode.replaceChild(node, anchor)
      } else if (node instanceof Element) {
        removeOwnClass(node, HIDDEN_ORIGINAL_CLASS)
      }
    }
    record.hidden = []
    record.wrapper?.removeAttribute('data-detached')
  }

  /** 移除段落的译文并恢复原文（调用方负责包在 mute 内） */
  private removeRecord(record: ParagraphRecord) {
    this.showOriginal(record)
    record.wrapper?.remove()
    record.wrapper = null
    if (record.unclamped) removeOwnClass(record.unclamped, UNCLAMP_CLASS)
    record.unclamped = null
    this.dropRecord(record)
  }

  /** 只解除登记，不触碰 DOM */
  private dropRecord(record: ParagraphRecord) {
    this.records.delete(record)
    record.nodes.forEach((node) => {
      if (this.memberRecords.get(node) === record) this.memberRecords.delete(node)
    })
    const siblings = this.hostRecords.get(record.host)
    siblings?.delete(record)
    if (siblings && !siblings.size) this.hostRecords.delete(record.host)
  }

  /* ------------------------------ 增量监听 ------------------------------ */

  /** 执行 DOM 写操作且不被自身的 MutationObserver 捕获 */
  private mute(write: () => void) {
    if (this.mutation) this.collectMutations(this.mutation.takeRecords())
    try {
      write()
    } finally {
      this.mutation?.takeRecords()
    }
  }

  private collectMutations(list: MutationRecord[]) {
    if (!this.pageActive) return

    for (const mutation of list) {
      if (mutation.type === 'characterData') {
        if (!isInsideOwnUi(mutation.target)) this.pendingMutations.add(mutation.target)
        continue
      }
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.COMMENT_NODE || isOwnUi(node) || isInsideOwnUi(node)) return
        this.pendingMutations.add(node)
      })
    }

    if (this.pendingMutations.size && !this.mutationTimer) {
      this.mutationTimer = window.setTimeout(() => this.flushMutations(), MUTATION_DELAY)
    }
  }

  private findRecordOf(node: Node): ParagraphRecord | undefined {
    for (let current: Node | null = node; current && current !== document.body;) {
      const record = this.memberRecords.get(current)
      if (record && this.records.has(record)) return record
      current = current.parentNode
    }
    return undefined
  }

  /** 向上找到最高的「未遍历」祖先，作为新内容的切分起点 */
  private findUntraversedRoot(node: Node): Node {
    let current = node
    while (
      current.parentElement &&
      current.parentElement !== document.body &&
      !this.traversed.has(current.parentElement)
    ) {
      current = current.parentElement
    }
    return current
  }

  private isInRoots(node: Node): boolean {
    const selectors = this.rules.roots
    if (!selectors) return true
    const element = node instanceof Element ? node : node.parentElement
    return Boolean(element?.closest(selectors.join(',')))
  }

  private flushMutations() {
    this.mutationTimer = null
    if (!this.pageActive) {
      this.pendingMutations.clear()
      return
    }

    // 页面移除的段落：解除登记，避免 SPA 长时间运行后的内存累积
    this.records.forEach((record) => {
      if (!record.host.isConnected) this.dropRecord(record)
    })

    const hosts = new Set<Element>()
    const roots = new Set<Node>()

    for (const node of this.pendingMutations) {
      if (!node.isConnected || !this.isInRoots(node)) continue

      const record = this.findRecordOf(node)
      if (record) {
        hosts.add(record.host)
        continue
      }

      const parent = node.parentElement
      if (parent && this.hostRecords.get(parent)?.size) {
        hosts.add(parent)
        continue
      }

      const element = node instanceof Element ? node : parent
      if (!element || this.rules.isInsideExcluded(element)) continue
      roots.add(this.findUntraversedRoot(node))
    }
    this.pendingMutations.clear()

    this.probe.reset()
    const ctx = this.segmentContext()
    const handledHosts: Element[] = []

    for (const host of hosts) {
      const churn = (this.hostChurn.get(host) ?? 0) + 1
      this.hostChurn.set(host, churn)
      if (churn > MAX_HOST_RETRANSLATIONS || !host.isConnected) continue

      // 宿主内的旧段落全部移除后重新切分（缓存会让未变化的段落立即恢复）
      this.mute(() => {
        this.records.forEach((record) => {
          if (host.contains(record.host)) this.removeRecord(record)
        })
      })
      segmentChildren(host, ctx).forEach((group) => this.register(group, 'page'))
      handledHosts.push(host)
    }

    for (const root of roots) {
      if (!root.isConnected) continue
      if (handledHosts.some((host) => host.contains(root))) continue
      if ([...roots].some((other) => other !== root && other.contains(root))) continue
      segmentNode(root, ctx).forEach((group) => this.register(group, 'page'))
    }
  }
}
