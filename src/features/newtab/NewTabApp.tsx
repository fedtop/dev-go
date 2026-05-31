/**
 * 新标签页主体：主题应用 + 搜索框 + 快捷导航。
 */

import { useEffect, useRef, useState } from 'react'

import { SHIP_NAME, SITE_URL } from '@/utils/constants'
import { quickNavItems, searchEngine, themeMode, type QuickNavItem, type ThemeMode } from '@/utils/settings' // prettier-ignore
import { applyTheme, nextThemeMode, watchSystemTheme } from '@/utils/theme'
import { downloadConfig, mergeItems, parseConfig } from './config'
import { DEFAULT_QUICK_NAV } from './engines'
import QuickNav from './QuickNav'
import SearchBar from './SearchBar'

const THEME_ICON: Record<ThemeMode, string> = { system: '🖥️', light: '☀️', dark: '🌙' }
const THEME_LABEL: Record<ThemeMode, string> = { system: '跟随系统', light: '浅色', dark: '深色' }

export default function NewTabApp() {
  const [mode, setMode] = useState<ThemeMode>('system')
  const [items, setItems] = useState<QuickNavItem[]>([])
  const [ready, setReady] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // 初始化主题
  useEffect(() => {
    themeMode.getValue().then((m) => {
      setMode(m)
      applyTheme(m)
    })
  }, [])

  // system 模式下跟随系统配色变化
  useEffect(() => {
    applyTheme(mode)
    if (mode !== 'system') return undefined
    return watchSystemTheme(() => applyTheme('system'))
  }, [mode])

  // 初始化导航（首次为空则落库默认值）
  useEffect(() => {
    quickNavItems.getValue().then((stored) => {
      if (stored.length === 0) {
        setItems(DEFAULT_QUICK_NAV)
        quickNavItems.setValue(DEFAULT_QUICK_NAV)
      } else {
        setItems(stored)
      }
      setReady(true)
    })
  }, [])

  const updateItems = (next: QuickNavItem[]) => {
    setItems(next)
    quickNavItems.setValue(next)
  }

  const toggleTheme = () => {
    const next = nextThemeMode(mode)
    setMode(next)
    themeMode.setValue(next)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  const handleExport = async () => {
    const engine = await searchEngine.getValue()
    downloadConfig(
      { quickNavItems: items, themeMode: mode, searchEngine: engine },
      new Date().toISOString(),
    )
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (!file) return
    try {
      const config = parseConfig(await file.text())
      const { items: merged, added } = mergeItems(items, config.quickNavItems)
      updateItems(merged)
      if (config.themeMode) {
        setMode(config.themeMode)
        themeMode.setValue(config.themeMode)
      }
      if (config.searchEngine) searchEngine.setValue(config.searchEngine)
      showToast(added > 0 ? `已导入 ${added} 个导航` : '没有新导航（已存在的已跳过）')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败')
    }
  }

  return (
    <div className='min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 dark:from-slate-900 dark:to-slate-950 dark:text-slate-100'>
      {/* 顶栏 */}
      <header className='flex items-center justify-between px-6 py-4'>
        <div className='flex items-center gap-2'>
          <img src='/icons/48.png' alt='' className='h-6 w-6' />
          <span className='text-sm font-semibold tracking-tight'>{SHIP_NAME}</span>
        </div>
        <button
          type='button'
          onClick={toggleTheme}
          title={`主题：${THEME_LABEL[mode]}（点击切换）`}
          className='flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
        >
          <span className='text-sm leading-none'>{THEME_ICON[mode]}</span>
          {THEME_LABEL[mode]}
        </button>
      </header>

      {/* 主体 */}
      <main className='mx-auto flex w-full max-w-4xl flex-col items-center px-6'>
        <div className='mt-[12vh] mb-8 text-center'>
          <h1 className='bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-4xl font-bold text-transparent'>
            {SHIP_NAME}
          </h1>
          <p className='mt-2 text-sm text-slate-400'>为开发者打造的新标签页</p>
        </div>

        <SearchBar navItems={items} />

        {ready && (
          <section className='mt-10 w-full'>
            <div className='mb-3 flex items-center justify-between px-1'>
              <h2 className='text-xs font-medium uppercase tracking-wider text-slate-400'>
                快捷导航
              </h2>
              <div className='flex items-center gap-1.5'>
                <button
                  type='button'
                  onClick={handleExport}
                  className='rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200'
                >
                  导出
                </button>
                <button
                  type='button'
                  onClick={() => fileRef.current?.click()}
                  className='rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200'
                >
                  导入
                </button>
                <input
                  ref={fileRef}
                  type='file'
                  accept='application/json,.json'
                  className='hidden'
                  onChange={handleImport}
                />
              </div>
            </div>
            <QuickNav items={items} onChange={updateItems} />
          </section>
        )}
      </main>

      {/* 轻量提示 */}
      {toast && (
        <div className='fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-xs text-white shadow-lg dark:bg-slate-700'>
          {toast}
        </div>
      )}

      {/* 底部 */}
      <footer className='mt-12 pb-6 text-center text-xs text-slate-400'>
        <a
          href={SITE_URL}
          target='_blank'
          rel='noreferrer'
          className='transition-colors hover:text-blue-500'
        >
          {SHIP_NAME} on GitHub ↗
        </a>
      </footer>
    </div>
  )
}
