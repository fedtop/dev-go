/**
 * 新标签页搜索引擎定义、bang 语法解析、默认快捷导航。
 */

import type { QuickNavItem } from '@/utils/settings'
import { categoryOf } from './categories'

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

/** 首次使用时落库的默认导航（按分类组织，common → dev → ai → community → tools） */
export const DEFAULT_QUICK_NAV: QuickNavItem[] = [
  // 常用
  { id: 'google', title: 'Google', url: 'https://www.google.com', category: 'common' },
  { id: 'gmail', title: 'Gmail', url: 'https://mail.google.com', category: 'common' },
  { id: 'youtube', title: 'YouTube', url: 'https://www.youtube.com', category: 'common' },
  { id: 'bilibili', title: 'Bilibili', url: 'https://www.bilibili.com', category: 'common' },
  { id: 'zhihu', title: '知乎', url: 'https://www.zhihu.com', category: 'common' },
  { id: 'weibo', title: '微博', url: 'https://weibo.com', category: 'common' },
  { id: 'xiaohongshu', title: '小红书', url: 'https://www.xiaohongshu.com', category: 'common' },
  { id: 'douban', title: '豆瓣', url: 'https://www.douban.com', category: 'common' },
  { id: 'taobao', title: '淘宝', url: 'https://www.taobao.com', category: 'common' },
  { id: 'jd', title: '京东', url: 'https://www.jd.com', category: 'common' },
  { id: 'netease-music', title: '网易云音乐', url: 'https://music.163.com', category: 'common' },
  // 开发
  { id: 'github', title: 'GitHub', url: 'https://github.com', category: 'dev' },
  { id: 'mdn', title: 'MDN', url: 'https://developer.mozilla.org', category: 'dev' },
  { id: 'stackoverflow', title: 'Stack Overflow', url: 'https://stackoverflow.com', category: 'dev' }, // prettier-ignore
  { id: 'npm', title: 'npm', url: 'https://www.npmjs.com', category: 'dev' },
  { id: 'caniuse', title: 'Can I Use', url: 'https://caniuse.com', category: 'dev' },
  { id: 'devdocs', title: 'DevDocs', url: 'https://devdocs.io', category: 'dev' },
  { id: 'vercel', title: 'Vercel', url: 'https://vercel.com/dashboard', category: 'dev' },
  { id: 'docker-hub', title: 'Docker Hub', url: 'https://hub.docker.com', category: 'dev' },
  { id: 'web-dev', title: 'web.dev', url: 'https://web.dev', category: 'dev' },
  {
    id: 'chrome-extensions',
    title: 'Chrome Extensions',
    url: 'https://developer.chrome.com/docs/extensions',
    category: 'dev',
  },
  { id: 'bundlephobia', title: 'Bundlephobia', url: 'https://bundlephobia.com', category: 'dev' },
  { id: 'typescript', title: 'TypeScript', url: 'https://www.typescriptlang.org', category: 'dev' },
  { id: 'leetcode', title: 'LeetCode', url: 'https://leetcode.cn', category: 'dev' },
  { id: 'react', title: 'React', url: 'https://react.dev', category: 'dev' },
  { id: 'vue', title: 'Vue', url: 'https://cn.vuejs.org', category: 'dev' },
  { id: 'vite', title: 'Vite', url: 'https://vite.dev', category: 'dev' },
  { id: 'nodejs', title: 'Node.js', url: 'https://nodejs.org', category: 'dev' },
  { id: 'tailwindcss', title: 'Tailwind CSS', url: 'https://tailwindcss.com', category: 'dev' },
  { id: 'cloudflare', title: 'Cloudflare', url: 'https://dash.cloudflare.com', category: 'dev' },
  { id: 'gitee', title: 'Gitee', url: 'https://gitee.com', category: 'dev' },
  { id: 'gitlab', title: 'GitLab', url: 'https://gitlab.com', category: 'dev' },
  // AI
  { id: 'huggingface', title: 'HuggingFace', url: 'https://huggingface.co', category: 'ai' },
  { id: 'chatgpt', title: 'ChatGPT', url: 'https://chatgpt.com', category: 'ai' },
  { id: 'claude', title: 'Claude', url: 'https://claude.ai', category: 'ai' },
  { id: 'deepseek', title: 'DeepSeek', url: 'https://chat.deepseek.com', category: 'ai' },
  { id: 'gemini', title: 'Gemini', url: 'https://gemini.google.com', category: 'ai' },
  { id: 'kimi', title: 'Kimi', url: 'https://www.kimi.com', category: 'ai' },
  { id: 'qwen', title: '通义千问', url: 'https://chat.qwen.ai', category: 'ai' },
  { id: 'modelscope', title: 'ModelScope', url: 'https://modelscope.cn', category: 'ai' },
  { id: 'doubao', title: '豆包', url: 'https://www.doubao.com', category: 'ai' },
  { id: 'grok', title: 'Grok', url: 'https://grok.com', category: 'ai' },
  { id: 'perplexity', title: 'Perplexity', url: 'https://www.perplexity.ai', category: 'ai' },
  { id: 'chatglm', title: '智谱清言', url: 'https://chatglm.cn', category: 'ai' },
  { id: 'openrouter', title: 'OpenRouter', url: 'https://openrouter.ai', category: 'ai' },
  { id: 'lmarena', title: 'LMArena', url: 'https://lmarena.ai', category: 'ai' },
  { id: 'midjourney', title: 'Midjourney', url: 'https://www.midjourney.com', category: 'ai' },
  { id: 'cursor', title: 'Cursor', url: 'https://cursor.com', category: 'ai' },
  // 社区
  { id: 'x', title: 'X', url: 'https://x.com', category: 'community' },
  { id: 'v2ex', title: 'V2EX', url: 'https://www.v2ex.com', category: 'community' },
  { id: 'juejin', title: '掘金', url: 'https://juejin.cn', category: 'community' },
  { id: 'hackernews', title: 'Hacker News', url: 'https://news.ycombinator.com', category: 'community' }, // prettier-ignore
  { id: 'reddit', title: 'Reddit', url: 'https://www.reddit.com', category: 'community' },
  { id: 'github-trending', title: 'GitHub Trending', url: 'https://github.com/trending', category: 'community' }, // prettier-ignore
  { id: 'sspai', title: '少数派', url: 'https://sspai.com', category: 'community' },
  { id: 'producthunt', title: 'Product Hunt', url: 'https://www.producthunt.com', category: 'community' }, // prettier-ignore
  { id: 'linuxdo', title: 'Linux.do', url: 'https://linux.do', category: 'community' },
  { id: 'devto', title: 'DEV Community', url: 'https://dev.to', category: 'community' },
  { id: 'medium', title: 'Medium', url: 'https://medium.com', category: 'community' },
  { id: 'segmentfault', title: 'SegmentFault', url: 'https://segmentfault.com', category: 'community' }, // prettier-ignore
  { id: 'cnblogs', title: '博客园', url: 'https://www.cnblogs.com', category: 'community' },
  { id: 'oschina', title: '开源中国', url: 'https://www.oschina.net', category: 'community' },
  { id: 'ruanyf-weekly', title: '阮一峰周刊', url: 'https://github.com/ruanyf/weekly', category: 'community' }, // prettier-ignore
  { id: 'eleduck', title: '电鸭社区', url: 'https://eleduck.com', category: 'community' },
  // 工具
  { id: 'figma', title: 'Figma', url: 'https://www.figma.com', category: 'tools' },
  { id: 'excalidraw', title: 'Excalidraw', url: 'https://excalidraw.com', category: 'tools' },
  { id: 'codepen', title: 'CodePen', url: 'https://codepen.io', category: 'tools' },
  { id: 'tinypng', title: 'TinyPNG', url: 'https://tinypng.com', category: 'tools' },
  { id: 'regex101', title: 'regex101', url: 'https://regex101.com', category: 'tools' },
  { id: 'jsoncrack', title: 'JSON Crack', url: 'https://jsoncrack.com', category: 'tools' },
  { id: 'deepl', title: 'DeepL', url: 'https://www.deepl.com/translator', category: 'tools' },
  { id: 'yuque', title: '语雀', url: 'https://www.yuque.com', category: 'tools' },
  { id: 'notion', title: 'Notion', url: 'https://www.notion.so', category: 'tools' },
  { id: 'drawio', title: 'draw.io', url: 'https://app.diagrams.net', category: 'tools' },
  { id: 'hoppscotch', title: 'Hoppscotch', url: 'https://hoppscotch.io', category: 'tools' },
  { id: 'stackblitz', title: 'StackBlitz', url: 'https://stackblitz.com', category: 'tools' },
  { id: 'it-tools', title: 'IT-Tools', url: 'https://it-tools.tech', category: 'tools' },
  { id: 'squoosh', title: 'Squoosh', url: 'https://squoosh.app', category: 'tools' },
  { id: 'carbon', title: 'Carbon', url: 'https://carbon.now.sh', category: 'tools' },
  { id: 'crontab-guru', title: 'Crontab Guru', url: 'https://crontab.guru', category: 'tools' },
  { id: 'jwt-io', title: 'JWT.io', url: 'https://jwt.io', category: 'tools' },
  { id: 'photopea', title: 'Photopea', url: 'https://www.photopea.com', category: 'tools' },
  { id: 'caoliao', title: '草料二维码', url: 'https://cli.im', category: 'tools' },
]

/** 历史版本的默认导航 id 排列（顺序严格），用于识别从未自定义过的老用户 */
const LEGACY_DEFAULT_IDS_V1 = [
  'github',
  'mdn',
  'stackoverflow',
  'npm',
  'juejin',
  'caniuse',
  'devdocs',
  'vercel',
]
const LEGACY_DEFAULT_IDS_V2 = [
  ...LEGACY_DEFAULT_IDS_V1,
  'chrome-extensions',
  'web-dev',
  'bundlephobia',
  'docker-hub',
  'codepen',
]

/** 列表与某个历史默认排列完全一致（没增删、没调序）→ 视为从未自定义 */
export function isUncustomizedDefault(items: QuickNavItem[]): boolean {
  const matches = (ids: string[]) =>
    items.length === ids.length && items.every((item, index) => item.id === ids[index])
  return matches(LEGACY_DEFAULT_IDS_V1) || matches(LEGACY_DEFAULT_IDS_V2)
}

/** 一次性种子：只往「空分类」补默认站点，按 URL/id 去重，不动用户已有卡片 */
export function seedEmptyCategories(stored: QuickNavItem[]): QuickNavItem[] {
  const usedUrls = new Set(stored.map((item) => item.url))
  const usedIds = new Set(stored.map((item) => item.id))
  const nonEmpty = new Set(stored.map(categoryOf))
  const additions = DEFAULT_QUICK_NAV.filter(
    (item) => !nonEmpty.has(categoryOf(item)) && !usedUrls.has(item.url) && !usedIds.has(item.id),
  )
  return additions.length > 0 ? [...stored, ...additions] : stored
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values))
}

function normalizeFaviconHost(hostname: string): string {
  return hostname.replace(/^www\./i, '')
}

/** 取站点 favicon 候选地址，供并发竞速（见 faviconCache.ts）；站点直连源对国内站点最快 */
export function faviconUrls(url: string, size = 64): string[] {
  try {
    const { hostname } = new URL(url)
    const hosts = uniq([normalizeFaviconHost(hostname), hostname])
    return uniq([
      ...hosts.map((host) => `https://${host}/favicon.ico`),
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
