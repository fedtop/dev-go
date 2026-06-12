/**
 * 快捷导航分类 Tab：单色胶囊样式，贴合静谧背景基调。
 * 重命名是受控的（由右上角铅笔按钮触发，见 NewTabApp）；双击任意 Tab 是快捷方式。
 * 清空提交 = 恢复默认名。
 */

import { useRef } from 'react'

import { isImeComposing } from '@/utils/ime'
import type { QuickNavCategoryId, QuickNavCategoryLabels } from '@/utils/settings'
import { CATEGORY_LABEL_MAX, labelOf, QUICK_NAV_CATEGORIES } from './categories'

interface CategoryTabsProps {
  active: QuickNavCategoryId
  labels: QuickNavCategoryLabels
  /** 正在重命名的分类，null 表示未在编辑 */
  editing: QuickNavCategoryId | null
  onChange: (id: QuickNavCategoryId) => void
  onRename: (id: QuickNavCategoryId, label: string) => void
  onEditingChange: (id: QuickNavCategoryId | null) => void
}

export function PencilIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className={`${className} fill-none stroke-current`}>
      <path
        d='M16.5 3.9a2.1 2.1 0 0 1 3 3L7 19.4l-4 1 1-4Z'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
      />
    </svg>
  )
}

export default function CategoryTabs({
  active,
  labels,
  editing,
  onChange,
  onRename,
  onEditingChange,
}: CategoryTabsProps) {
  const composingRef = useRef(false)

  const commitEdit = (id: QuickNavCategoryId, value: string) => {
    onRename(id, value)
    onEditingChange(null)
  }

  return (
    <div role='tablist' aria-label='导航分类' className='flex items-center gap-1'>
      {QUICK_NAV_CATEGORIES.map((category) => {
        const selected = category.id === active

        if (editing === category.id) {
          return (
            <input
              key={category.id}
              autoFocus
              defaultValue={labelOf(category.id, labels)}
              maxLength={CATEGORY_LABEL_MAX}
              onBlur={(e) => commitEdit(category.id, e.target.value)}
              onCompositionStart={() => {
                composingRef.current = true
              }}
              onCompositionEnd={() => {
                composingRef.current = false
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isImeComposing(e, composingRef.current)) {
                  commitEdit(category.id, e.currentTarget.value)
                }
                if (e.key === 'Escape') onEditingChange(null)
              }}
              onFocus={(e) => e.target.select()}
              aria-label='重命名分类'
              className='w-20 rounded-full border border-blue-400 bg-white px-3 py-1 text-center text-xs text-slate-800 outline-none dark:bg-slate-800 dark:text-slate-100'
            />
          )
        }

        return (
          <button
            key={category.id}
            type='button'
            role='tab'
            aria-selected={selected}
            title='双击重命名'
            onClick={() => onChange(category.id)}
            onDoubleClick={() => onEditingChange(category.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
              selected
                ? 'bg-slate-900/90 font-medium text-white dark:bg-white/90 dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200'
            }`}
          >
            {labelOf(category.id, labels)}
          </button>
        )
      })}
    </div>
  )
}
