/**
 * 行内占位标记（wire format）工具。
 *
 * 内容脚本把段落编码为「纯文本 + `<bN>…</bN>` 标记」再发给翻译引擎（见 page/codec.ts）。
 * 微软 / Google 免费接口的纯文本模式与大模型都会原样保留这些标记；
 * 这里提供引擎两侧通用的标记解析与剥离（Service Worker 里没有 DOMParser，基于词法扫描实现）。
 */

/** 容忍模型输出多余空格：`< b 0 >`、`</ b0>` 都能识别 */
const MARKER_PATTERN = /<\s*(\/?)\s*b\s*(\d+)\s*>/gi

export type MarkerToken =
  | { type: 'text'; value: string }
  | { type: 'open'; id: number }
  | { type: 'close'; id: number }

export function tokenizeMarkers(text: string): MarkerToken[] {
  const tokens: MarkerToken[] = []
  let lastIndex = 0

  for (const match of text.matchAll(MARKER_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) tokens.push({ type: 'text', value: text.slice(lastIndex, index) })
    tokens.push({ type: match[1] ? 'close' : 'open', id: Number(match[2]) })
    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) })
  return tokens
}

export function stripMarkers(text: string): string {
  return text.replace(MARKER_PATTERN, '')
}

export function hasMarkers(text: string): boolean {
  return new RegExp(MARKER_PATTERN.source, 'i').test(text)
}
