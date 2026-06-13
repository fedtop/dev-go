/**
 * 新标签页搜索框：引擎切换 + bang 语法 + 联想下拉（键盘可操作）。
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import { isImeComposing } from '@/utils/ime'
import type { QuickNavItem } from '@/utils/settings'
import { searchEngine } from '@/utils/settings'
import { buildSearchUrl, ENGINES, getEngine, parseBang, type SearchEngine } from './engines'
import SiteIcon from './SiteIcon'
import { useSuggestions } from './useSuggestions'

interface SearchBarProps {
  navItems: QuickNavItem[]
}

export default function SearchBar({ navItems }: SearchBarProps) {
  const [engineId, setEngineId] = useState('google')
  const [input, setInput] = useState('')
  const [enginePickerOpen, setEnginePickerOpen] = useState(false)
  const [active, setActive] = useState(-1) // 当前高亮的联想项
  const [focused, setFocused] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)

  const { engine: bangEngine, query } = parseBang(input)
  const currentEngine = getEngine(engineId)
  const effectiveEngine = bangEngine ?? currentEngine
  const hasQuery = query.trim().length > 0
  const inputActive = focused || input.trim().length > 0
  const queryMeter = hasQuery ? Math.min(1, Math.max(0.14, query.trim().length / 28)) : 0
  const inputMeterStyle = { '--query-meter': `${Math.round(queryMeter * 100)}%` } as CSSProperties

  const suggestions = useSuggestions(query, navItems)
  const showDropdown = focused && (suggestions.length > 0 || !!bangEngine)

  // 加载持久化的引擎
  useEffect(() => {
    searchEngine.getValue().then(setEngineId)
  }, [])

  // 点击外部关闭引擎选择器
  useEffect(() => {
    if (!enginePickerOpen) return undefined
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setEnginePickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [enginePickerOpen])

  // 联想列表变化时重置高亮
  useEffect(() => setActive(-1), [input])

  const pickEngine = (e: SearchEngine) => {
    setEngineId(e.id)
    searchEngine.setValue(e.id)
    setEnginePickerOpen(false)
    inputRef.current?.focus()
  }

  const go = (url: string) => {
    window.location.href = url
  }

  const submit = () => {
    if (active >= 0 && suggestions[active]) {
      go(suggestions[active].url)
      return
    }
    if (!query.trim()) return
    go(buildSearchUrl(effectiveEngine, query))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 输入法组词中：回车 / 方向键交给 IME 处理候选词，避免误触提交或移动高亮
    if (isImeComposing(e, composingRef.current)) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      setFocused(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div
      ref={rootRef}
      className={`relative w-full ${enginePickerOpen || showDropdown ? 'z-40' : 'z-10'}`}
    >
      <div
        className={`aurora-search-shell relative flex items-center gap-1 rounded-[1.35rem] px-2 py-1.5 transition-all ${
          inputActive ? 'is-active' : ''
        }`}
      >
        <span aria-hidden='true' className='aurora-search-glow' />

        {/* 引擎选择 */}
        <div className='relative z-10'>
          <button
            type='button'
            onClick={() => setEnginePickerOpen((v) => !v)}
            className='cursor-pointer flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
          >
            <span className='text-base leading-none'>{currentEngine.icon}</span>
            <span className='hidden sm:inline'>{currentEngine.name}</span>
            <svg width='10' height='10' viewBox='0 0 12 12' className='text-slate-400'>
              <path d='M2 4l4 4 4-4' stroke='currentColor' strokeWidth='1.5' fill='none' />
            </svg>
          </button>
          {enginePickerOpen && (
            <div className='aurora-dropdown absolute left-0 top-full z-[70] mt-2 w-52 overflow-hidden rounded-2xl p-1.5'>
              {ENGINES.map((e) => (
                <button
                  key={e.id}
                  type='button'
                  onClick={() => pickEngine(e)}
                  className={`cursor-pointer aurora-dropdown-item group/engine flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm ${
                    e.id === engineId ? 'is-selected' : ''
                  }`}
                >
                  <span className='aurora-engine-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base leading-none'>
                    {e.icon}
                  </span>
                  <span className='min-w-0 flex-1 truncate'>{e.name}</span>
                  <kbd className='aurora-engine-kbd shrink-0 rounded-md px-1.5 py-0.5 text-[10px]'>
                    !{e.bang}
                  </kbd>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className='relative z-10 h-5 w-px bg-slate-200/80 dark:bg-slate-700/80' />

        <div
          className={`aurora-input-wrap relative z-10 flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xl px-2.5 py-1 ${
            inputActive ? 'is-active' : ''
          } ${hasQuery ? 'has-query' : ''}`}
          style={inputMeterStyle}
        >
          <span
            aria-hidden='true'
            className='aurora-input-orb relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-300'
          >
            <svg viewBox='0 0 24 24' className='h-3.5 w-3.5 fill-none stroke-current'>
              <circle cx='11' cy='11' r='6.5' strokeWidth='2' />
              <path d='m20 20-4.1-4.1' strokeLinecap='round' strokeWidth='2' />
            </svg>
          </span>

          <input
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={() => {
              composingRef.current = false
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={`用 ${effectiveEngine.name} 搜索，或输入 !${
              currentEngine.bang === 'g' ? 'gh' : 'g'
            } 切换引擎…`}
            className='aurora-input-control relative z-10 min-w-0 flex-1 bg-transparent px-0 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100'
          />

          {/* bang 命中提示 */}
          {bangEngine && (
            <span className='aurora-bang-chip relative z-10 flex max-w-[7rem] shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-300'>
              <span>{bangEngine.icon}</span>
              <span className='truncate'>{bangEngine.name}</span>
            </span>
          )}

          <span aria-hidden='true' className='aurora-input-meter' />
        </div>

        <button
          type='button'
          onClick={submit}
          className='cursor-pointer aurora-btn aurora-pan group/search relative z-10 shrink-0 overflow-hidden rounded-xl px-4 py-1.5 text-sm font-semibold text-white hover:scale-[1.04] active:scale-95'
        >
          {/* 周期扫过的高光 */}
          <span
            aria-hidden='true'
            className='aurora-btn-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/35 blur-md'
          />
          <span className='relative flex items-center gap-1.5'>
            <svg
              viewBox='0 0 24 24'
              aria-hidden='true'
              className='h-3.5 w-3.5 fill-none stroke-current transition-transform duration-300 group-hover/search:rotate-12 group-hover/search:scale-110'
            >
              <circle cx='11' cy='11' r='7' strokeWidth='2.2' />
              <path d='m20.5 20.5-4.2-4.2' strokeLinecap='round' strokeWidth='2.2' />
            </svg>
            搜索
          </span>
        </button>
      </div>

      {/* 联想下拉 */}
      {showDropdown && suggestions.length > 0 && (
        <div className='aurora-dropdown absolute left-0 right-0 top-full z-[60] mt-2 overflow-hidden rounded-2xl p-1.5'>
          {suggestions.map((s, i) => (
            <button
              key={`${s.source}-${s.url}`}
              type='button'
              onMouseEnter={() => setActive(i)}
              onClick={() => go(s.url)}
              className={`aurora-dropdown-item flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left ${
                i === active ? 'is-active' : ''
              }`}
            >
              <SiteIcon
                url={s.url}
                title={s.title}
                size={32}
                className='h-5 w-5 shrink-0 rounded-md'
              />
              <span className='min-w-0 flex-1 truncate text-sm font-medium'>{s.title}</span>
              <span className='aurora-suggestion-url hidden max-w-[42%] shrink-0 truncate text-xs sm:block'>
                {s.url}
              </span>
              <span
                className={`aurora-source-chip shrink-0 rounded-md px-1.5 py-0.5 text-[10px] ${
                  s.source === 'nav' ? 'is-nav' : 'is-bookmark'
                }`}
              >
                {s.source === 'nav' ? '导航' : '书签'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
