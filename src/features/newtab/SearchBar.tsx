/**
 * 新标签页搜索框：引擎切换 + bang 语法 + 联想下拉（键盘可操作）。
 */

import { useEffect, useRef, useState } from 'react'

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

  const { engine: bangEngine, query } = parseBang(input)
  const currentEngine = getEngine(engineId)
  const effectiveEngine = bangEngine ?? currentEngine

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

  const onKeyDown = (e: React.KeyboardEvent) => {
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
    <div ref={rootRef} className='relative w-full'>
      <div className='flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition-shadow focus-within:shadow-md dark:border-slate-700 dark:bg-slate-800'>
        {/* 引擎选择 */}
        <div className='relative'>
          <button
            type='button'
            onClick={() => setEnginePickerOpen((v) => !v)}
            className='flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
          >
            <span className='text-base leading-none'>{currentEngine.icon}</span>
            <span className='hidden sm:inline'>{currentEngine.name}</span>
            <svg width='10' height='10' viewBox='0 0 12 12' className='text-slate-400'>
              <path d='M2 4l4 4 4-4' stroke='currentColor' strokeWidth='1.5' fill='none' />
            </svg>
          </button>
          {enginePickerOpen && (
            <div className='absolute left-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800'>
              {ENGINES.map((e) => (
                <button
                  key={e.id}
                  type='button'
                  onClick={() => pickEngine(e)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    e.id === engineId
                      ? 'font-medium text-blue-600 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className='w-5 text-center text-base leading-none'>{e.icon}</span>
                  <span className='flex-1'>{e.name}</span>
                  <kbd className='rounded bg-slate-100 px-1 text-[10px] text-slate-400 dark:bg-slate-700'>
                    !{e.bang}
                  </kbd>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className='h-5 w-px bg-slate-200 dark:bg-slate-700' />

        <input
          ref={inputRef}
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={`用 ${effectiveEngine.name} 搜索，或输入 !${
            currentEngine.bang === 'g' ? 'gh' : 'g'
          } 切换引擎…`}
          className='min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100'
        />

        {/* bang 命中提示 */}
        {bangEngine && (
          <span className='shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'>
            {bangEngine.icon} {bangEngine.name}
          </span>
        )}

        <button
          type='button'
          onClick={submit}
          className='aurora-btn aurora-pan group/search relative shrink-0 overflow-hidden rounded-xl px-4 py-1.5 text-sm font-semibold text-white hover:scale-[1.04] active:scale-95'
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
        <div className='absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800'>
          {suggestions.map((s, i) => (
            <button
              key={`${s.source}-${s.url}`}
              type='button'
              onMouseEnter={() => setActive(i)}
              onClick={() => go(s.url)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                i === active ? 'bg-slate-100 dark:bg-slate-700' : ''
              }`}
            >
              <SiteIcon
                url={s.url}
                title={s.title}
                size={32}
                className='h-4 w-4 shrink-0 rounded-sm'
              />
              <span className='flex-1 truncate text-sm text-slate-700 dark:text-slate-200'>
                {s.title}
              </span>
              <span className='shrink-0 truncate text-xs text-slate-400'>{s.url}</span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                  s.source === 'nav'
                    ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
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
