import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { useFloatingMenu } from './useFloatingMenu'

export interface ComboboxOption {
  value: string
  /** 右侧附注（如「推荐」「来自服务」） */
  note?: string
}

interface ComboboxProps {
  value: string
  options: ComboboxOption[]
  onChange: (value: string) => void
  /** 下拉打开时回调（如按需拉取远程选项） */
  onOpen?: () => void
  placeholder?: string
  /** 下拉顶部的状态行（加载中 / 获取失败等） */
  status?: ReactNode
  className?: string
  inputClassName?: string
}

/** 可输入、可下拉选择的组合框：输入即过滤，也允许填写列表外的任意值 */
export default function Combobox({
  value,
  options,
  onChange,
  onOpen,
  placeholder,
  status,
  className = '',
  inputClassName = '',
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  /** 打开后是否输入过：未输入时展示全部选项，输入后按关键字过滤 */
  const [filtering, setFiltering] = useState(false)
  const [active, setActive] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(() => {
    const keyword = value.trim().toLowerCase()
    if (!filtering || !keyword) return options
    return options.filter((option) => option.value.toLowerCase().includes(keyword))
  }, [filtering, options, value])

  const menuStyle = useFloatingMenu(ref, open, { maxHeight: 240 })

  const openMenu = () => {
    if (open) return
    setOpen(true)
    setFiltering(false)
    setActive(-1)
    onOpen?.()
  }

  const close = useCallback(() => {
    setOpen(false)
    setActive(-1)
  }, [])

  const select = (next: string) => {
    onChange(next)
    close()
    inputRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, close])

  // 键盘高亮项滚动到可见区域
  useEffect(() => {
    if (active < 0) return
    menuRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openMenu()
        return
      }
      if (!visible.length) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + visible.length) % visible.length)
    } else if (event.key === 'Enter') {
      if (open && active >= 0 && visible[active]) {
        event.preventDefault()
        select(visible[active].value)
      } else {
        close()
      }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      close()
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete='off'
        role='combobox'
        aria-expanded={open}
        aria-autocomplete='list'
        onFocus={openMenu}
        onClick={openMenu}
        onKeyDown={onKeyDown}
        onChange={(event) => {
          onChange(event.target.value)
          setFiltering(true)
          setActive(-1)
          if (!open) openMenu()
        }}
        className={`popup-field w-full rounded-lg border pr-7 text-slate-700 outline-none transition-colors placeholder:text-slate-400 ${inputClassName}`}
      />
      <button
        type='button'
        tabIndex={-1}
        aria-label='展开选项'
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) close()
          else {
            inputRef.current?.focus()
            openMenu()
          }
        }}
        className='absolute inset-y-0 right-0 flex w-7 items-center justify-center text-slate-400'
      >
        <svg
          width='10'
          height='10'
          viewBox='0 0 12 12'
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d='M2 4l4 4 4-4' stroke='currentColor' strokeWidth='1.5' fill='none' />
        </svg>
      </button>

      {open &&
        (visible.length > 0 || status) &&
        createPortal(
          <div
            ref={menuRef}
            role='listbox'
            style={menuStyle}
            className='popup-select-menu fixed z-50 overflow-y-auto overscroll-contain rounded-xl p-1'
          >
            {status && <div className='px-2.5 py-1.5 text-xs text-slate-400'>{status}</div>}
            {visible.map((option, index) => (
              <button
                key={option.value}
                type='button'
                role='option'
                aria-selected={option.value === value}
                data-index={index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(option.value)}
                className={`popup-select-item flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                  option.value === value || index === active ? 'is-selected' : ''
                } ${option.value === value ? 'font-medium' : ''}`}
              >
                <span className='truncate'>{option.value}</span>
                {option.note && (
                  <span className='shrink-0 text-[11px] font-normal text-slate-400'>
                    {option.note}
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
