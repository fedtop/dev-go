/**
 * 固定栏：钉住的导航卡片，位于搜索框与分类列表之间。
 * 上限 16 个（满两行），满后由 NewTabApp 拦截并提示；这里负责展示与移出。
 */

import type { QuickNavItem } from '@/utils/settings'
import SiteIcon from './SiteIcon'

/** 固定栏容量上限：md 及以上为 8 列，正好两行 */
export const PIN_LIMIT = 16

export function PinIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className={`${className} fill-none stroke-current`}>
      <path
        d='M15 4.5l-4 4-4 1.5-1.5 1.5 7 7 1.5-1.5 1.5-4 4-4'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
      />
      <path d='m9 15-4.5 4.5M14.5 4 20 9.5' strokeLinecap='round' strokeWidth='2' />
    </svg>
  )
}

interface PinnedNavProps {
  /** 已固定的导航项（父组件负责排序） */
  items: QuickNavItem[]
  onUnpin: (id: string) => void
}

export default function PinnedNav({ items, onUnpin }: PinnedNavProps) {
  if (items.length === 0) return null

  return (
    <section className='mt-8 w-full'>
      <div className='mb-2 flex items-center gap-1.5 px-1 text-xs text-slate-400 dark:text-slate-500'>
        <PinIcon className='h-3 w-3' />
        <span>固定</span>
        <span className='text-slate-300 dark:text-slate-600'>
          {items.length}/{PIN_LIMIT}
        </span>
      </div>
      <div className='grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8'>
        {items.map((item) => (
          <div key={item.id} className='group relative'>
            <a
              href={item.url}
              target='_blank'
              rel='noreferrer'
              className='flex flex-col items-center gap-1.5 rounded-xl border border-transparent bg-white/70 px-1.5 py-2.5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md dark:bg-white/[0.06] dark:hover:border-white/10'
            >
              <SiteIcon url={item.url} title={item.title} className='h-7 w-7 rounded-lg' />
              <span className='line-clamp-1 w-full text-[11px] text-slate-600 dark:text-slate-300'>
                {item.title}
              </span>
            </a>
            <button
              type='button'
              title='移出固定栏（不删除导航）'
              onClick={() => onUnpin(item.id)}
              className='absolute right-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-200/90 text-[10px] text-slate-600 opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100 dark:bg-slate-700 dark:text-slate-200'
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
