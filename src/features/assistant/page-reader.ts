/**
 * 网页正文读取（侧边栏助手总结 / 问答用）：沿渲染树（含开放的 shadow root 与 slot 投影）
 * 提取可见文字，保留标题、列表、代码块、表格的结构，输出 Markdown 风格的纯文本。
 *
 * 页面有 main / article 且其中正文足够多时只取这部分，略去导航、页眉页脚等噪音。
 */
import { composedChildNodes } from '@/features/translate/page/dom'
import type { PageContent } from '@/utils/messaging'

const DEFAULT_MAX_CHARS = 40_000
/** main / article 中的文字少于该值时，认为不是正文容器，改读整个 body */
const MIN_MAIN_CHARS = 400

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'CANVAS',
  'IFRAME',
  'OBJECT',
  'VIDEO',
  'AUDIO',
  'SELECT',
  'OPTION',
  'TEXTAREA',
  'INPUT',
])
/** 读取整个 body 时略过的页面框架 */
const CHROME_TAGS = new Set(['NAV', 'HEADER', 'FOOTER', 'ASIDE'])
const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'BLOCKQUOTE',
  'DD',
  'DETAILS',
  'DIALOG',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FORM',
  'HR',
  'LI',
  'MAIN',
  'OL',
  'P',
  'SECTION',
  'SUMMARY',
  'TABLE',
  'TBODY',
  'THEAD',
  'TFOOT',
  'UL',
  ...CHROME_TAGS,
])

class TextBuilder {
  private readonly lines: string[] = []
  private line = ''
  /** 当前行的前缀（列表符号、标题井号）：只有前缀没有内容的行不输出 */
  private prefix = ''
  length = 0

  constructor(private readonly limit: number) {}

  get full() {
    return this.length >= this.limit
  }

  inline(text: string) {
    if (!text || this.full) return
    const normalized = text.replace(/\s+/g, ' ')
    if (!normalized.trim() && (!this.line || this.line.endsWith(' '))) return
    this.line += this.line ? normalized : normalized.trimStart()
  }

  raw(text: string) {
    this.break()
    this.push(text)
  }

  break() {
    const line = this.line.trim()
    const prefixOnly = line === this.prefix.trim()
    this.line = ''
    this.prefix = ''
    if (line && !prefixOnly) this.push(line)
  }

  /** 段落之间空一行 */
  gap() {
    this.break()
    if (this.lines.length && this.lines[this.lines.length - 1] !== '') this.lines.push('')
  }

  setPrefix(prefix: string) {
    this.break()
    this.line = prefix
    this.prefix = prefix
  }

  private push(text: string) {
    this.lines.push(text)
    this.length += text.length + 1
  }

  toString() {
    this.break()
    return this.lines.join('\n').trim()
  }
}

function isHidden(element: Element): boolean {
  if (element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('hidden')) return true
  if (!element.checkVisibility) return false
  // display: contents（slot、部分自定义元素）没有布局盒子，checkVisibility 会误判为不可见
  if (element.checkVisibility({ visibilityProperty: true, opacityProperty: false })) return false
  return getComputedStyle(element).display !== 'contents'
}

function isBlock(element: Element): boolean {
  return BLOCK_TAGS.has(element.tagName) || element.tagName.includes('-')
}

function walk(node: Node, out: TextBuilder, options: { skipChrome: boolean; listDepth: number }) {
  if (out.full) return
  if (node.nodeType === Node.TEXT_NODE) {
    out.inline(node.textContent ?? '')
    return
  }
  if (!(node instanceof Element)) {
    if (node instanceof DocumentFragment) {
      composedChildNodes(node).forEach((child) => walk(child, out, options))
    }
    return
  }

  const tag = node.tagName
  if (SKIP_TAGS.has(tag) || (options.skipChrome && CHROME_TAGS.has(tag)) || isHidden(node)) return

  const heading = /^H([1-6])$/.exec(tag)
  if (heading) {
    out.gap()
    out.setPrefix(`${'#'.repeat(Number(heading[1]))} `)
    composedChildNodes(node).forEach((child) => walk(child, out, options))
    out.gap()
    return
  }

  switch (tag) {
    case 'BR':
      out.break()
      return
    case 'HR':
      out.gap()
      return
    case 'IMG': {
      const alt = node.getAttribute('alt')?.trim()
      if (alt) out.inline(` [图片：${alt}] `)
      return
    }
    case 'PRE':
      out.gap()
      out.raw(`\`\`\`\n${(node.textContent ?? '').replace(/\n+$/, '')}\n\`\`\``)
      out.gap()
      return
    case 'LI':
      out.setPrefix(`${'  '.repeat(Math.max(0, options.listDepth - 1))}- `)
      composedChildNodes(node).forEach((child) => walk(child, out, options))
      out.break()
      return
    case 'UL':
    case 'OL': {
      out.break()
      const nested = { ...options, listDepth: options.listDepth + 1 }
      composedChildNodes(node).forEach((child) => walk(child, out, nested))
      if (options.listDepth === 0) out.gap()
      return
    }
    case 'TR': {
      const cells = Array.from(node.children)
        .filter((cell) => cell.tagName === 'TD' || cell.tagName === 'TH')
        .map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
      if (cells.some(Boolean)) out.raw(`| ${cells.join(' | ')} |`)
      return
    }
  }

  const block = isBlock(node)
  if (block) out.gap()
  composedChildNodes(node).forEach((child) => walk(child, out, options))
  if (block) out.gap()
}

function extract(root: Node, maxChars: number, skipChrome: boolean) {
  const out = new TextBuilder(maxChars)
  walk(root, out, { skipChrome, listDepth: 0 })
  return { text: out.toString(), truncated: out.full }
}

export function readPageContent(maxChars = DEFAULT_MAX_CHARS): PageContent {
  const main = document.querySelector('main, article, [role="main"]')
  let result = main ? extract(main, maxChars, false) : null
  if (!result || result.text.length < MIN_MAIN_CHARS) {
    result = extract(document.body, maxChars, true)
  }

  return {
    url: location.href,
    title: document.title,
    text: result.text.slice(0, maxChars),
    selection: window.getSelection()?.toString().trim() ?? '',
    truncated: result.truncated,
  }
}
