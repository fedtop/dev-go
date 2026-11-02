import type { ReactNode } from 'react'

export const INPUT_CLASS =
  'popup-field w-full rounded-lg border px-3 py-2 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400'

export function Card({
  title,
  desc,
  extra,
  children,
}: {
  title: string
  desc?: ReactNode
  /** 标题栏右侧的附加内容（徽标、操作按钮） */
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <section className='rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm'>
      <div className='flex items-start justify-between gap-4'>
        <div className='min-w-0'>
          <h2 className='text-base font-semibold text-slate-800'>{title}</h2>
          {desc && <p className='mt-1 text-xs leading-relaxed text-slate-400'>{desc}</p>}
        </div>
        {extra && <div className='shrink-0'>{extra}</div>}
      </div>
      <div className='mt-4 flex flex-col gap-4'>{children}</div>
    </section>
  )
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className='flex items-center justify-between gap-6'>
      <div className='flex min-w-0 flex-col'>
        <span className='text-sm text-slate-700'>{label}</span>
        {hint && <span className='text-xs leading-relaxed text-slate-400'>{hint}</span>}
      </div>
      <div className='shrink-0'>{children}</div>
    </div>
  )
}

/** 设置分区的标题（右侧主区域顶部） */
export function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h1 className='text-xl font-semibold text-slate-800'>{title}</h1>
      <p className='mt-1 text-sm text-slate-400'>{desc}</p>
    </div>
  )
}
