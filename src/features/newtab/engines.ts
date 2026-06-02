/**
 * 新标签页搜索引擎定义、bang 语法解析、默认快捷导航。
 */

import type { QuickNavItem } from '@/utils/settings'

export interface SearchEngine {
  id: string
  /** 展示名 */
  name: string
  /** 搜索 URL 前缀，拼接 encodeURIComponent(query) */
  queryUrl: string
  /** bang 触发词（不含 !），如 npm → 输入 `!npm xxx` 临时切换 */
  bang: string
  /** 单字符/emoji 图标（避免引入图标库） */
  icon: string
}

export const ENGINES: SearchEngine[] = [
  { id: 'google', name: 'Google', queryUrl: 'https://www.google.com/search?q=', bang: 'g', icon: 'G' }, // prettier-ignore
  { id: 'baidu', name: '百度', queryUrl: 'https://www.baidu.com/s?wd=', bang: 'bd', icon: '百' },
  { id: 'bing', name: 'Bing', queryUrl: 'https://www.bing.com/search?q=', bang: 'b', icon: 'B' },
  { id: 'npm', name: 'npm', queryUrl: 'https://www.npmjs.com/search?q=', bang: 'npm', icon: '📦' },
  { id: 'github', name: 'GitHub', queryUrl: 'https://github.com/search?q=', bang: 'gh', icon: '🐙' }, // prettier-ignore
  { id: 'mdn', name: 'MDN', queryUrl: 'https://developer.mozilla.org/zh-CN/search?q=', bang: 'mdn', icon: '🦊' }, // prettier-ignore
  { id: 'stackoverflow', name: 'Stack Overflow', queryUrl: 'https://stackoverflow.com/search?q=', bang: 'so', icon: '💬' }, // prettier-ignore
]

export const DEFAULT_ENGINE_ID = 'google'

/** 根据 id 取引擎，找不到回退到默认 */
export function getEngine(id: string): SearchEngine {
  return ENGINES.find((e) => e.id === id) ?? ENGINES.find((e) => e.id === DEFAULT_ENGINE_ID)!
}

export interface ParsedInput {
  /** bang 命中的引擎（临时覆盖当前引擎），未命中为 null */
  engine: SearchEngine | null
  /** 去掉 bang 前缀后的实际查询词 */
  query: string
}

/**
 * 解析 bang 语法：`!gh react` → 用 GitHub 搜 `react`。
 * 仅在 `!词 ` 后还有内容时才视为 bang，否则原样返回。
 */
export function parseBang(input: string): ParsedInput {
  const m = /^!(\S+)\s+(.*)$/.exec(input)
  if (m) {
    const engine = ENGINES.find((e) => e.bang === m[1].toLowerCase())
    if (engine) return { engine, query: m[2] }
  }
  return { engine: null, query: input }
}

/** 粗略判断输入是否是一个可直接访问的 URL / 域名 */
export function looksLikeUrl(input: string): boolean {
  const s = input.trim()
  if (/\s/.test(s)) return false
  if (/^https?:\/\//i.test(s)) return true
  // 形如 example.com、a.b.cn/path
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)
}

/** 把输入构造为最终跳转地址：URL 直达，否则按引擎搜索 */
export function buildSearchUrl(engine: SearchEngine, input: string): string {
  const q = input.trim()
  if (looksLikeUrl(q)) return /^https?:\/\//i.test(q) ? q : `https://${q}`
  return engine.queryUrl + encodeURIComponent(q)
}

/** 首次使用时落库的默认开发者导航 */
export const DEFAULT_QUICK_NAV: QuickNavItem[] = [
  { id: 'github', title: 'GitHub', url: 'https://github.com' },
  { id: 'mdn', title: 'MDN', url: 'https://developer.mozilla.org' },
  { id: 'stackoverflow', title: 'Stack Overflow', url: 'https://stackoverflow.com' },
  { id: 'npm', title: 'npm', url: 'https://www.npmjs.com' },
  { id: 'juejin', title: '掘金', url: 'https://juejin.cn' },
  { id: 'caniuse', title: 'Can I Use', url: 'https://caniuse.com' },
  { id: 'devdocs', title: 'DevDocs', url: 'https://devdocs.io' },
  { id: 'vercel', title: 'Vercel', url: 'https://vercel.com/dashboard' },
  {
    id: 'chrome-extensions',
    title: 'Chrome Extensions',
    url: 'https://developer.chrome.com/docs/extensions',
  },
  { id: 'web-dev', title: 'web.dev', url: 'https://web.dev' },
  { id: 'bundlephobia', title: 'Bundlephobia', url: 'https://bundlephobia.com' },
  { id: 'docker-hub', title: 'Docker Hub', url: 'https://hub.docker.com' },
  { id: 'codepen', title: 'CodePen', url: 'https://codepen.io' },
]

function uniq(values: string[]): string[] {
  return Array.from(new Set(values))
}

function normalizeFaviconHost(hostname: string): string {
  return hostname.replace(/^www\./i, '')
}

/** 取站点 favicon 候选地址，按顺序兜底 */
export function faviconUrls(url: string, size = 64): string[] {
  try {
    const { hostname } = new URL(url)
    const hosts = uniq([normalizeFaviconHost(hostname), hostname])
    return uniq([
      ...hosts.map(
        (host) =>
          `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`,
      ),
      ...hosts.map((host) => `https://icons.duckduckgo.com/ip3/${host}.ico`),
      ...hosts.map((host) => `https://icon.horse/icon/${host}`),
    ])
  } catch {
    return []
  }
}

/** 取首个 favicon 地址，兼容只需要单图地址的场景 */
export function faviconUrl(url: string, size = 64): string {
  return faviconUrls(url, size)[0] ?? ''
}
