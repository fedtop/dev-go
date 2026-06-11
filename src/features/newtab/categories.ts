/**
 * 快捷导航分类定义与工具。
 */

import type { QuickNavCategoryId, QuickNavCategoryLabels, QuickNavItem } from '@/utils/settings'

export interface QuickNavCategory {
  id: QuickNavCategoryId
  label: string
}

export const QUICK_NAV_CATEGORIES: QuickNavCategory[] = [
  { id: 'common', label: '常用' },
  { id: 'dev', label: '开发' },
  { id: 'ai', label: 'AI' },
  { id: 'community', label: '社区' },
  { id: 'tools', label: '工具' },
]

export const DEFAULT_CATEGORY: QuickNavCategoryId = 'common'

/** 分类自定义名称的最大长度 */
export const CATEGORY_LABEL_MAX = 12

export function isQuickNavCategory(value: unknown): value is QuickNavCategoryId {
  return QUICK_NAV_CATEGORIES.some((category) => category.id === value)
}

/** 取分类默认名 */
export function defaultLabelOf(id: QuickNavCategoryId): string {
  return QUICK_NAV_CATEGORIES.find((category) => category.id === id)!.label
}

/** 取分类展示名：优先用户自定义，缺省用默认名 */
export function labelOf(id: QuickNavCategoryId, overrides?: QuickNavCategoryLabels): string {
  return overrides?.[id]?.trim() || defaultLabelOf(id)
}

/** 清洗外部输入（导入 / 备份）的分类名称覆盖：只收已知分类、非空、与默认名不同的字符串 */
export function sanitizeCategoryLabels(input: unknown): QuickNavCategoryLabels {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const result: QuickNavCategoryLabels = {}
  QUICK_NAV_CATEGORIES.forEach(({ id, label: fallback }) => {
    const raw = (input as Record<string, unknown>)[id]
    if (typeof raw !== 'string') return
    const label = raw.trim().slice(0, CATEGORY_LABEL_MAX)
    if (label && label !== fallback) result[id] = label
  })
  return result
}

/** 旧数据无 category 字段，统一视为「常用」 */
export function categoryOf(item: QuickNavItem): QuickNavCategoryId {
  return item.category ?? DEFAULT_CATEGORY
}
