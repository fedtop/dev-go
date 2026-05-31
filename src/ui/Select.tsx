import { useEffect, useRef, useState } from 'react'

interface Option {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: Option[]
  onChange?: (value: string) => void
  className?: string
}

/** 自定义下拉（完全可控样式，替代系统原生 select） */
export default function Select({ value, options, onChange, className = '' }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = options.find((o) => o.value === value)

  // 点击外部关闭
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const select = (v: string) => {
    onChange?.(v)
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:border-blue-400'
      >
        <span className='truncate'>{current?.label ?? ''}</span>
        <svg
          width='10'
          height='10'
          viewBox='0 0 12 12'
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d='M2 4l4 4 4-4' stroke='currentColor' strokeWidth='1.5' fill='none' />
        </svg>
      </button>

      {open && (
        <div className='absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/60'>
          {options.map((o) => (
            <button
              key={o.value}
              type='button'
              onClick={() => select(o.value)}
              className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-blue-50 ${
                o.value === value ? 'font-medium text-blue-600' : 'text-slate-700'
              }`}
            >
              <span className='truncate'>{o.label}</span>
              {o.value === value && (
                <svg width='12' height='12' viewBox='0 0 12 12' className='shrink-0'>
                  <path
                    d='M2.5 6.5l2.5 2.5 4.5-5'
                    stroke='currentColor'
                    strokeWidth='1.6'
                    fill='none'
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
