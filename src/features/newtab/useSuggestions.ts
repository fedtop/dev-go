/**
 * 搜索联想：聚合本地快捷导航 + 浏览器书签，按匹配度排序去重。
 * 无 bookmarks 权限或调用失败时静默降级为仅本地。
 */

import { useEffect, useState } from 'react'

import type { QuickNavItem } from '@/utils/settings'

export interface Suggestion {
  title: string
  url: string
  source: 'nav' | 'bookmark'
}

const MAX = 8

/** 匹配打分：标题/URL 命中越靠前分越高，未命中返回 -1 */
function score(q: string, title: string, url: string): number {
  const t = title.toLowerCase()
  const u = url.toLowerCase()
  if (t.startsWith(q)) return 100
  if (t.includes(q)) return 60
  if (u.includes(q)) return 30
  return -1
}

async function searchBookmarks(q: string): Promise<Suggestion[]> {
  try {
    if (!browser.bookmarks?.search) return []
    const nodes = await browser.bookmarks.search({ query: q })
    return nodes
      .filter((n) => n.url)
      .map((n) => ({ title: n.title || n.url!, url: n.url!, source: 'bookmark' as const }))
  } catch {
    return []
  }
}

export function useSuggestions(rawQuery: string, navItems: QuickNavItem[]): Suggestion[] {
  const [list, setList] = useState<Suggestion[]>([])

  useEffect(() => {
    const q = rawQuery.trim().toLowerCase()
    if (!q) {
      setList([])
      return undefined
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      const local: Array<Suggestion & { rank: number }> = navItems
        .map((n) => ({
          title: n.title,
          url: n.url,
          source: 'nav' as const,
          rank: score(q, n.title, n.url),
        }))
        .filter((s) => s.rank >= 0)

      const marks = await searchBookmarks(q)
      if (cancelled) return

      const seen = new Set(local.map((s) => s.url))
      const remote = marks
        .filter((s) => !seen.has(s.url))
        .map((s) => ({ ...s, rank: score(q, s.title, s.url) }))
        .filter((s) => s.rank >= 0)

      const merged = [...local, ...remote]
        .sort((a, b) => b.rank - a.rank)
        .slice(0, MAX)
        .map(({ rank, ...rest }) => rest)

      setList(merged)
    }, 120)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [rawQuery, navItems])

  return list
}
