/**
 * 段落编解码：DOM 节点 ⇄「纯文本 + <bN> 行内标记」。
 *
 * encode：格式化标签（链接、加粗、强调…）编码为 <bN>…</bN>，内部文字照常翻译；
 *         原子元素（行内 code、公式、时间…）编码为 <bN>原文</bN>，译文中整体原样复制；
 *         其余标签（span、font…）透明展开。
 * decode：把译文按标记还原成 DocumentFragment —— 标签来自原节点克隆，文字一律作为
 *         文本节点插入，从不使用 innerHTML，模型输出无法注入任何标记或脚本。
 *         标记结构损坏时退化为纯文本，保证总能展示。
 */

import { tokenizeMarkers } from '@/features/translate/markers'

import { isOwnUi, normalizeWhitespace } from './dom'
import type { TranslateRules } from './rules'

/** 保留为标记、内部文字可翻译的行内格式标签 */
const FORMAT_TAGS = new Set([
  'A',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'MARK',
  'S',
  'DEL',
  'INS',
  'SUB',
  'SUP',
  'SMALL',
  'ABBR',
  'CITE',
  'Q',
])

/** 单段最多保留的标记数：过多标记会明显降低翻译质量，超出部分透明展开 */
const MAX_MARKERS = 24

interface EncodedTag {
  element: Element
  atomic: boolean
}

export interface EncodedParagraph {
  /** 发给引擎的文本 */
  text: string
  tags: EncodedTag[]
  /** 参与了编码的顶层成员（「仅译文」模式只隐藏这些，按钮、输入框等保持原位） */
  represented: Node[]
}

function encodeNode(node: Node, tags: EncodedTag[], rules: TranslateRules): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof Element) || isOwnUi(node)) return ''
  if (node.tagName === 'BR') return ' '

  const verdict = rules.verdict(node)
  if (verdict === 'skip') return ''

  if (verdict === 'atomic') {
    const text = normalizeWhitespace(node.textContent ?? '')
    if (!text) return ''
    if (tags.length >= MAX_MARKERS) return text
    const id = tags.push({ element: node, atomic: true }) - 1
    return `<b${id}>${text}</b${id}>`
  }

  if (FORMAT_TAGS.has(node.tagName) && tags.length < MAX_MARKERS) {
    const id = tags.push({ element: node, atomic: false }) - 1
    const inner = encodeChildren(node, tags, rules)
    if (!inner.trim()) {
      tags.pop()
      return inner
    }
    return `<b${id}>${inner}</b${id}>`
  }

  return encodeChildren(node, tags, rules)
}

function encodeChildren(element: Element, tags: EncodedTag[], rules: TranslateRules): string {
  let output = ''
  for (const child of element.childNodes) output += encodeNode(child, tags, rules)
  return output
}

export function encodeParagraph(nodes: Node[], rules: TranslateRules): EncodedParagraph {
  const tags: EncodedTag[] = []
  const represented: Node[] = []
  let text = ''

  for (const node of nodes) {
    const encoded = encodeNode(node, tags, rules)
    if (node.nodeType === Node.TEXT_NODE || encoded.trim()) represented.push(node)
    text += encoded
  }

  return { text: normalizeWhitespace(text), tags, represented }
}

/* -------------------------------- 解码 -------------------------------- */

/** 克隆原标签：去掉 id（避免重复）与内联事件属性 */
function cloneTag(element: Element, deep: boolean): Element {
  const clone = element.cloneNode(deep) as Element
  const targets = [clone, ...(deep ? Array.from(clone.querySelectorAll('*')) : [])]
  for (const target of targets) {
    target.removeAttribute('id')
    for (const attr of Array.from(target.attributes)) {
      if (attr.name.toLowerCase().startsWith('on')) target.removeAttribute(attr.name)
    }
  }
  return clone
}

/** 去掉模型偶尔包裹的引号 / 首尾换行 */
function cleanTranslation(text: string): string {
  return text.replace(/^["'“”‘’\n]+|["'“”‘’\n]+$/g, '').trim()
}

/** 整段只有一个格式标签且译文丢了标记时，把整段译文重新包回该标签（保持链接可点） */
function rewrapSingleTag(source: EncodedParagraph, translated: string): string {
  if (source.tags.length !== 1 || source.tags[0].atomic) return translated
  if (!/^<b0>[\s\S]*<\/b0>$/.test(source.text)) return translated
  return /<\s*\/?\s*b\s*\d+\s*>/i.test(translated) ? translated : `<b0>${translated}</b0>`
}

function buildFragment(translated: string, source: EncodedParagraph): DocumentFragment | null {
  const fragment = document.createDocumentFragment()
  const stack: Array<{ id: number; parent: Node }> = []
  const used = new Set<number>()
  let parent: Node = fragment
  /** 位于原子标记内部：模型给出的文字丢弃，使用原文克隆 */
  let atomicDepth = 0

  for (const token of tokenizeMarkers(translated)) {
    if (token.type === 'text') {
      if (!atomicDepth && token.value) parent.appendChild(document.createTextNode(token.value))
      continue
    }

    const tag = source.tags[token.id]
    if (!tag) return null

    if (token.type === 'open') {
      if (used.has(token.id)) return null
      used.add(token.id)
      if (tag.atomic) {
        if (!atomicDepth) parent.appendChild(cloneTag(tag.element, true))
        atomicDepth += 1
        stack.push({ id: token.id, parent })
        continue
      }
      const clone = cloneTag(tag.element, false)
      parent.appendChild(clone)
      stack.push({ id: token.id, parent })
      parent = clone
      continue
    }

    // 闭合标记：容忍轻微错序，弹出到对应的开标记；找不到则忽略
    const position = stack.map((entry) => entry.id).lastIndexOf(token.id)
    if (position < 0) continue
    while (stack.length > position) {
      const entry = stack.pop()
      if (!entry) break
      if (source.tags[entry.id]?.atomic) atomicDepth = Math.max(0, atomicDepth - 1)
      parent = entry.parent
    }
  }

  return fragment
}

/** 译文 → 可直接插入页面的 DocumentFragment */
export function decodeTranslation(translated: string, source: EncodedParagraph): DocumentFragment {
  const cleaned = rewrapSingleTag(source, cleanTranslation(translated))
  const fragment = buildFragment(cleaned, source)
  if (fragment) return fragment

  const fallback = document.createDocumentFragment()
  fallback.appendChild(document.createTextNode(cleaned.replace(/<\s*\/?\s*b\s*\d+\s*>/gi, '')))
  return fallback
}

/** 判断译文与原文是否实质相同（已是目标语言 / 无需翻译） */
export function isSameAsSource(sourceText: string, translatedText: string): boolean {
  const normalize = (value: string) =>
    value
      .replace(/<\s*\/?\s*b\s*\d+\s*>/gi, '')
      .replace(/[\s\p{P}]/gu, '')
      .toLowerCase()
  return normalize(sourceText) === normalize(translatedText)
}
