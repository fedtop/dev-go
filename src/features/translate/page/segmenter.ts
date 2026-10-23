/**
 * 段落切分：把 DOM 切成「一组连续的兄弟节点 = 一个段落」。
 *
 * 算法（参照豆包，基于计算样式而非标签名）：
 * - 有块级后代的元素是「容器」，递归进入；
 * - 没有块级后代的块级元素是「叶子段落」，其子节点整体成段（单子元素时向下收敛）；
 * - 行内元素与文本节点累积到当前段落，遇到块级边界或兄弟结束时成段。
 *
 * 相比豆包的改进：
 * - 行内装饰元素（图标、无文字 span）和标签之间的空白文本不再打断段落；
 * - 被排除的行内元素（行内 code、时间、@提及）作为原子留在段落中，而不是把句子切成两半。
 */

import { isBlankText, isOwnUi, hasText, type LayoutProbe } from './dom'
import type { TranslateRules } from './rules'

export interface ParagraphGroup {
  /** 段落成员：同一父节点下连续的兄弟节点 */
  nodes: Node[]
  /** 成员的父元素 */
  host: Element
}

export interface SegmentContext {
  rules: TranslateRules
  probe: LayoutProbe
  /** 已遍历过的元素（供增量切分判断「新内容」） */
  traversed: WeakSet<Element>
}

class GroupCollector {
  private pending: Node[] = []

  constructor(private readonly output: ParagraphGroup[]) {}

  push(node: Node) {
    this.pending.push(node)
  }

  pushWhitespace(node: Node) {
    // 段落中间的空白保留（单词间距），开头的空白丢弃
    if (this.pending.length) this.pending.push(node)
  }

  flush() {
    const nodes = this.pending
    this.pending = []
    while (nodes.length && isBlankTextNode(nodes[nodes.length - 1])) nodes.pop()
    addGroup(this.output, nodes)
  }
}

function isBlankTextNode(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE && isBlankText(node.textContent)
}

function addGroup(output: ParagraphGroup[], nodes: Node[]) {
  const host = nodes[0]?.parentElement
  if (!host || !nodes.some(hasText)) return
  output.push({ nodes, host })
}

/** 叶子段落向下收敛：唯一有意义的子元素时进入它，让译文贴近文字（如 li > a 时放进 a 里） */
function collapseParagraph(element: Element, ctx: SegmentContext): Node[] {
  const meaningful = Array.from(element.childNodes).filter(
    (node) =>
      (node.nodeType === Node.TEXT_NODE && !isBlankText(node.textContent)) ||
      (node instanceof Element && !isOwnUi(node)),
  )
  const [only] = meaningful
  if (
    meaningful.length === 1 &&
    only instanceof Element &&
    only.childNodes.length > 0 &&
    ctx.rules.verdict(only) === undefined
  ) {
    ctx.traversed.add(only)
    return collapseParagraph(only, ctx)
  }

  return Array.from(element.childNodes).filter(
    (node) => node.nodeType === Node.TEXT_NODE || (node instanceof Element && !isOwnUi(node)),
  )
}

function visit(
  node: Node,
  collector: GroupCollector,
  output: ParagraphGroup[],
  ctx: SegmentContext,
) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (isBlankText(node.textContent)) collector.pushWhitespace(node)
    else collector.push(node)
    return
  }

  // 注释、处理指令等不影响文字流
  if (!(node instanceof Element)) return

  if (isOwnUi(node)) {
    collector.flush()
    return
  }

  ctx.traversed.add(node)
  const verdict = ctx.rules.verdict(node)

  if (verdict === 'skip') {
    collector.flush()
    return
  }

  if (!hasText(node)) {
    // 无文字的行内元素（图标、空 span）对文字流透明；块级空元素作为边界
    if (!ctx.probe.isInline(node)) collector.flush()
    return
  }

  if (verdict === 'atomic') {
    collector.push(node)
    return
  }

  if (verdict === 'paragraph') {
    collector.flush()
    addGroup(output, collapseParagraph(node, ctx))
    return
  }

  if (verdict === 'container' || ctx.probe.hasBlockDescendant(node)) {
    collector.flush()
    collectChildren(node, output, ctx)
    return
  }

  if (ctx.probe.isBlockLevel(node)) {
    collector.flush()
    addGroup(output, collapseParagraph(node, ctx))
    return
  }

  collector.push(node)
}

function collectChildren(parent: Node, output: ParagraphGroup[], ctx: SegmentContext) {
  const collector = new GroupCollector(output)
  for (const child of Array.from(parent.childNodes)) visit(child, collector, output, ctx)
  collector.flush()
}

/** 切分根元素的全部子内容（整页翻译入口） */
export function segmentChildren(root: Element, ctx: SegmentContext): ParagraphGroup[] {
  const output: ParagraphGroup[] = []
  ctx.traversed.add(root)
  collectChildren(root, output, ctx)
  return output
}

/** 把节点本身当作切分起点（增量内容、悬停翻译） */
export function segmentNode(node: Node, ctx: SegmentContext): ParagraphGroup[] {
  const output: ParagraphGroup[] = []
  const collector = new GroupCollector(output)
  visit(node, collector, output, ctx)
  collector.flush()
  return output
}
