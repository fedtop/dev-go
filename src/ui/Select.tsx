import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

interface Option {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: Option[]
  onChange?: (value: string) => void
  className?: string
  placement?: 'bottom' | 'top'
}

/** 自定义下拉（完全可控样式，替代系统原生 select） */
export default function Select({
  value,
  options,
  onChange,
  className = '',
  placement = 'bottom',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const current = options.find((o) => o.value === value)
  const updateMenuPosition = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return

    const gap = 4
    setMenuStyle({
      left: rect.left,
      width: rect.width,
      ...(placement === 'top'
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    })
  }, [placement])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [open, updateMenuPosition])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  const select = (v: string) => {
    onChange?.(v)
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='popup-field flex w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm text-slate-700 transition-colors'
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

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className='popup-select-menu fixed z-50 overflow-hidden rounded-xl p-1'
          >
            {options.map((o) => (
              <button
                key={o.value}
                type='button'
                onClick={() => select(o.value)}
                className={`popup-select-item flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                  o.value === value ? 'is-selected font-medium' : ''
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
          </div>,
          document.body,
        )}
    </div>
  )
}
