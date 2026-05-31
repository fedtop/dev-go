/**
 * 新标签页配置的导入 / 导出：用于在不同设备 / 浏览器间共享与迁移。
 *
 * 导出为带版本号的 JSON；导入时做容错校验，仅接收合法字段。
 */

import type { QuickNavItem, ThemeMode } from '@/utils/settings'

const FORMAT = 'devgo-newtab'
const VERSION = 1

export interface NewTabConfig {
  searchEngine?: string
  themeMode?: ThemeMode
  quickNavItems: QuickNavItem[]
}

interface ConfigFile extends NewTabConfig {
  format: typeof FORMAT
  version: number
  exportedAt: string
}

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark']

function isValidUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** 把任意输入清洗成合法的导航项数组（丢弃非法项） */
function sanitizeItems(input: unknown): QuickNavItem[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === 'object')
    .map((raw) => {
      const { id, title, url } = raw
      if (typeof title !== 'string' || typeof url !== 'string') return null
      if (!title.trim() || !isValidUrl(url)) return null
      return {
        id: typeof id === 'string' && id ? id : crypto.randomUUID(),
        title: title.trim(),
        url,
      }
    })
    .filter((item): item is QuickNavItem => item !== null)
}

/** 序列化为可下载的 JSON 字符串 */
export function serializeConfig(config: NewTabConfig, now: string): string {
  const file: ConfigFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: now,
    searchEngine: config.searchEngine,
    themeMode: config.themeMode,
    quickNavItems: config.quickNavItems,
  }
  return JSON.stringify(file, null, 2)
}

/** 触发浏览器下载导出文件 */
export function downloadConfig(config: NewTabConfig, now: string): void {
  const blob = new Blob([serializeConfig(config, now)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `devgo-newtab-${now.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 解析并校验导入的 JSON 文本，非法时抛错 */
export function parseConfig(text: string): NewTabConfig {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('文件不是合法的 JSON')
  }
  if (!data || typeof data !== 'object') throw new Error('配置格式不正确')

  const obj = data as Record<string, unknown>
  if (obj.format !== FORMAT) throw new Error('不是 DevGo 新标签页配置文件')

  const items = sanitizeItems(obj.quickNavItems)
  if (items.length === 0) throw new Error('文件中没有可导入的导航项')

  const themeMode = THEME_MODES.includes(obj.themeMode as ThemeMode)
    ? (obj.themeMode as ThemeMode)
    : undefined
  const searchEngine = typeof obj.searchEngine === 'string' ? obj.searchEngine : undefined

  return { quickNavItems: items, themeMode, searchEngine }
}

/**
 * 把导入项合并进现有导航：按 url 去重，已存在的跳过，新项追加。
 * 返回合并后的列表与新增数量，便于给用户反馈。
 */
export function mergeItems(
  current: QuickNavItem[],
  incoming: QuickNavItem[],
): { items: QuickNavItem[]; added: number } {
  const seen = new Set(current.map((i) => i.url))
  const fresh = incoming.filter((i) => !seen.has(i.url))
  return { items: [...current, ...fresh], added: fresh.length }
}
