/**
 * 新标签页主体：主题应用 + 搜索框 + 快捷导航。
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { SHIP_NAME, SITE_URL } from '@/utils/constants'
import { isNewtabShaderEffect, newtabActiveCategory, newtabShaderEffect, newtabShaderMode, newtabShaderRandomSeeded, quickNavBuiltinPagesSeeded, quickNavCategoryLabels, quickNavCategorySeeded, quickNavDefaultPinsSeeded, quickNavItems, searchEngine, themeMode, type NewtabShaderEffect, type NewtabShaderMode, type QuickNavCategoryId, type QuickNavCategoryLabels, type QuickNavItem, type ThemeMode } from '@/utils/settings' // prettier-ignore
import { applyTheme, normalizeThemeMode, watchAutoTheme } from '@/utils/theme'
import { CATEGORY_LABEL_MAX, defaultLabelOf, isQuickNavCategory } from './categories'
import CategoryTabs, { PencilIcon } from './CategoryTabs'
import { downloadConfig, mergeItems, parseConfig } from './config'
import {
  DEFAULT_PINNED_NAV_IDS,
  DEFAULT_QUICK_NAV,
  isUncustomizedDefault,
  seedBuiltinBrowserPages,
  seedDefaultPinnedItems,
  seedEmptyCategories,
} from './engines'
import PinnedNav, { PIN_LIMIT } from './PinnedNav'
import QuickNav from './QuickNav'
import QuietBackground, { SHADER_EFFECT_OPTIONS } from './QuietBackground'
import SearchBar from './SearchBar'

const THEME_LABEL: Record<ThemeMode, string> = { auto: '自动', light: '浅色', dark: '深色' }
const THEME_OPTIONS: ThemeMode[] = ['dark', 'auto', 'light']
const SHADER_MODE_LABEL: Record<NewtabShaderMode, string> = { random: '随机', fixed: '固定' }
const FIRST_RANDOM_SHADER_EFFECT: NewtabShaderEffect = 'mesh'
const THEME_THUMB_OFFSET: Record<ThemeMode, string> = {
  dark: 'translate-x-0',
  auto: 'translate-x-[41px]',
  light: 'translate-x-[82px]',
}
const DEFAULT_PINNED_ORDER = new Map(DEFAULT_PINNED_NAV_IDS.map((id, index) => [id, index]))

function getRandomShaderEffect(current?: NewtabShaderEffect): NewtabShaderEffect {
  const effects = SHADER_EFFECT_OPTIONS.map((item) => item.id)
  const pool =
    current && effects.length > 1 ? effects.filter((effect) => effect !== current) : effects
  return pool[Math.floor(Math.random() * pool.length)] ?? FIRST_RANDOM_SHADER_EFFECT
}

function MoonIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-4 w-4 fill-none stroke-current'>
      <path
        d='M20.3 14.6A7.7 7.7 0 0 1 9.4 3.7 8.4 8.4 0 1 0 20.3 14.6Z'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
      />
    </svg>
  )
}

function AutoIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-4 w-4 fill-none stroke-current'>
      <path
        d='M20.5 12a8.5 8.5 0 1 1-2.1-5.6'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.9'
      />
      <path d='M18.7 3.8v3.4h-3.4M12 7.2V12l3 1.8' strokeLinecap='round' strokeWidth='1.9' />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-4 w-4 fill-none stroke-current'>
      <path d='M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z' strokeWidth='1.9' />
      <path
        d='M12 2.8v2.1M12 19.1v2.1M4.1 4.1l1.5 1.5M18.4 18.4l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.1 19.9l1.5-1.5M18.4 5.6l1.5-1.5'
        strokeLinecap='round'
        strokeWidth='1.9'
      />
    </svg>
  )
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'dark') return <MoonIcon />
  if (mode === 'light') return <SunIcon />
  return <AutoIcon />
}

function BackgroundIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-4 w-4 fill-none stroke-current'>
      <path
        d='M4 8.5c2.6-2.7 5.3-2.7 8 0s5.4 2.7 8 0M4 15.5c2.6-2.7 5.3-2.7 8 0s5.4 2.7 8 0'
        strokeLinecap='round'
        strokeWidth='2'
      />
    </svg>
  )
}

function getThemeSwitchBg(mode: ThemeMode, effectiveDark: boolean): string {
  if (mode === 'dark') {
    return 'border-slate-700 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 shadow-slate-950/20'
  }
  if (mode === 'light') {
    return 'border-amber-200 bg-gradient-to-r from-sky-100 via-blue-50 to-amber-100 shadow-amber-200/50'
  }
  return effectiveDark
    ? 'border-slate-700 bg-gradient-to-r from-slate-950 via-slate-800 to-sky-950 shadow-slate-950/20'
    : 'border-sky-200 bg-gradient-to-r from-sky-100 via-white to-amber-100 shadow-sky-200/50'
}

function getThemeThumbBg(mode: ThemeMode): string {
  if (mode === 'dark') return 'bg-slate-950 shadow-slate-950/40'
  if (mode === 'light') return 'bg-amber-300 shadow-amber-300/50'
  return 'bg-white shadow-slate-300/60 dark:bg-slate-700 dark:shadow-slate-950/30'
}

function getThemeIconColor(option: ThemeMode, selected: boolean): string {
  if (!selected) {
    return 'text-slate-500/70 hover:text-slate-700 dark:text-slate-400/80 dark:hover:text-slate-100'
  }
  if (option === 'dark') return 'text-slate-100'
  if (option === 'light') return 'text-amber-950'
  return 'text-sky-700 dark:text-sky-100'
}

function getThemeIconTransform(option: ThemeMode, selected: boolean): string {
  if (!selected) return 'scale-100'
  if (option === 'light') return 'rotate-90 scale-110'
  return 'scale-110'
}

function ThemeSwitch({
  mode,
  effectiveDark,
  onChange,
}: {
  mode: ThemeMode
  effectiveDark: boolean
  onChange: (mode: ThemeMode) => void
}) {
  return (
    <div
      role='radiogroup'
      aria-label='颜色主题'
      title={`当前：${THEME_LABEL[mode]}${
        mode === 'auto' ? `（当前${effectiveDark ? '深色' : '浅色'}）` : ''
      }`}
      className={`relative grid h-10 w-[132px] grid-cols-3 items-center overflow-hidden rounded-full border p-1 shadow-sm transition-all duration-500 ${getThemeSwitchBg(
        mode,
        effectiveDark,
      )}`}
    >
      <span
        aria-hidden='true'
        className={`pointer-events-none absolute left-1 top-1 h-8 w-10 rounded-full ring-1 ring-white/60 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          THEME_THUMB_OFFSET[mode]
        } ${getThemeThumbBg(mode)}`}
      />
      {THEME_OPTIONS.map((option) => {
        const selected = option === mode
        return (
          <button
            key={option}
            type='button'
            role='radio'
            aria-checked={selected}
            aria-label={THEME_LABEL[option]}
            title={THEME_LABEL[option]}
            onClick={() => onChange(option)}
            className={`relative z-10 flex h-8 w-10 items-center justify-center rounded-full outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
              selected ? 'scale-110' : 'scale-95'
            } ${getThemeIconColor(option, selected)}`}
          >
            <span
              className={`transition-transform duration-500 ${getThemeIconTransform(
                option,
                selected,
              )}`}
            >
              <ThemeIcon mode={option} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function NewTabApp() {
  const [mode, setMode] = useState<ThemeMode>('auto')
  const [shaderMode, setShaderMode] = useState<NewtabShaderMode>('random')
  const [shaderEffect, setShaderEffect] = useState<NewtabShaderEffect>(FIRST_RANDOM_SHADER_EFFECT)
  const [effectMenuOpen, setEffectMenuOpen] = useState(false)
  const [effectiveDark, setEffectiveDark] = useState(false)
  const [items, setItems] = useState<QuickNavItem[]>([])
  const [activeCategory, setActiveCategory] = useState<QuickNavCategoryId>('common')
  const [categoryLabels, setCategoryLabels] = useState<QuickNavCategoryLabels>({})
  const [renamingCategory, setRenamingCategory] = useState<QuickNavCategoryId | null>(null)
  const [ready, setReady] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const effectMenuRef = useRef<HTMLDivElement>(null)

  // 初始化主题
  useEffect(() => {
    Promise.all([
      themeMode.getValue(),
      newtabShaderMode.getValue(),
      newtabShaderEffect.getValue(),
      newtabShaderRandomSeeded.getValue(),
    ]).then(([stored, storedShaderMode, storedShaderEffect, randomSeeded]) => {
      const m = normalizeThemeMode(stored)
      const nextShaderEffect =
        storedShaderMode === 'random'
          ? randomSeeded
            ? getRandomShaderEffect()
            : FIRST_RANDOM_SHADER_EFFECT
          : isNewtabShaderEffect(storedShaderEffect)
            ? storedShaderEffect
            : FIRST_RANDOM_SHADER_EFFECT // 已下线的效果回落到默认

      setShaderMode(storedShaderMode)
      setShaderEffect(nextShaderEffect)
      setMode(m)
      setEffectiveDark(applyTheme(m))
      if (stored !== m) themeMode.setValue(m)
      if (storedShaderMode === 'random' && !randomSeeded) {
        newtabShaderRandomSeeded.setValue(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!effectMenuOpen) return undefined

    const close = (event: MouseEvent) => {
      if (effectMenuRef.current?.contains(event.target as Node)) return
      setEffectMenuOpen(false)
    }

    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [effectMenuOpen])

  // auto 模式下按时间分界点自动切换。
  useLayoutEffect(() => {
    setEffectiveDark(applyTheme(mode))
    if (mode !== 'auto') return undefined
    return watchAutoTheme(() => setEffectiveDark(applyTheme('auto')))
  }, [mode])

  // 初始化导航：首次为空落库分类默认；老用户做一次性种子
  // （没改过旧默认 → 整体换新版分类默认；自定义过 → 只往空分类补默认站点）。
  useEffect(() => {
    ;(async () => {
      const [stored, seeded, defaultPinsSeeded, builtinPagesSeeded, savedCategory, savedLabels] =
        await Promise.all([
          quickNavItems.getValue(),
          quickNavCategorySeeded.getValue(),
          quickNavDefaultPinsSeeded.getValue(),
          quickNavBuiltinPagesSeeded.getValue(),
          newtabActiveCategory.getValue(),
          quickNavCategoryLabels.getValue(),
        ])

      let next = stored
      if (stored.length === 0) {
        next = DEFAULT_QUICK_NAV
      } else if (!seeded) {
        next = isUncustomizedDefault(stored) ? DEFAULT_QUICK_NAV : seedEmptyCategories(stored)
      }
      if (!defaultPinsSeeded) next = seedDefaultPinnedItems(next)
      if (!builtinPagesSeeded) next = seedBuiltinBrowserPages(next)
      if (next !== stored) quickNavItems.setValue(next)
      if (!seeded) quickNavCategorySeeded.setValue(true)
      if (!defaultPinsSeeded) quickNavDefaultPinsSeeded.setValue(true)
      if (!builtinPagesSeeded) quickNavBuiltinPagesSeeded.setValue(true)

      if (isQuickNavCategory(savedCategory)) setActiveCategory(savedCategory)
      setCategoryLabels(savedLabels)
      setItems(next)
      setReady(true)
    })()
  }, [])

  const updateItems = (next: QuickNavItem[]) => {
    setItems(next)
    quickNavItems.setValue(next).catch(() => {
      showToast('保存失败：同步空间已满，请删减部分导航')
    })
  }

  const changeCategory = (id: QuickNavCategoryId) => {
    setActiveCategory(id)
    newtabActiveCategory.setValue(id)
  }

  const pinnedItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.pinned)
    .sort((a, b) => {
      const aOrder = DEFAULT_PINNED_ORDER.get(a.item.id)
      const bOrder = DEFAULT_PINNED_ORDER.get(b.item.id)
      if (aOrder != null && bOrder != null) return aOrder - bOrder
      if (aOrder != null) return -1
      if (bOrder != null) return 1
      return a.index - b.index
    })
    .map(({ item }) => item)

  /** 固定 / 取消固定；固定栏满（PIN_LIMIT）时拦截并提示 */
  const togglePin = (id: string) => {
    const target = items.find((item) => item.id === id)
    if (!target) return
    if (!target.pinned && pinnedItems.length >= PIN_LIMIT) {
      showToast(`固定栏已满（最多 ${PIN_LIMIT} 个），请先移出一些`)
      return
    }
    updateItems(
      items.map((item) =>
        item.id === id ? { ...item, pinned: item.pinned ? undefined : true } : item,
      ),
    )
  }

  /** 重命名分类：空或与默认名相同 → 删除覆盖、恢复默认 */
  const renameCategory = (id: QuickNavCategoryId, raw: string) => {
    const label = raw.trim().slice(0, CATEGORY_LABEL_MAX)
    const next = { ...categoryLabels }
    if (!label || label === defaultLabelOf(id)) delete next[id]
    else next[id] = label
    setCategoryLabels(next)
    quickNavCategoryLabels.setValue(next)
  }

  const changeTheme = (next: ThemeMode) => {
    setMode(next)
    setEffectiveDark(applyTheme(next))
    themeMode.setValue(next)
  }

  const changeShaderMode = (next: NewtabShaderMode) => {
    setShaderMode(next)
    newtabShaderMode.setValue(next)

    if (next === 'random') {
      const nextEffect = getRandomShaderEffect(shaderEffect)
      setShaderEffect(nextEffect)
      newtabShaderRandomSeeded.setValue(true)
      return
    }

    newtabShaderEffect.setValue(shaderEffect)
  }

  const changeShaderEffect = (next: NewtabShaderEffect) => {
    setShaderMode('fixed')
    setShaderEffect(next)
    setEffectMenuOpen(false)
    newtabShaderMode.setValue('fixed')
    newtabShaderEffect.setValue(next)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  const handleExport = async () => {
    const engine = await searchEngine.getValue()
    downloadConfig(
      {
        quickNavItems: items,
        themeMode: mode,
        shaderMode,
        shaderEffect,
        searchEngine: engine,
        categoryLabels,
      },
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
        setEffectiveDark(applyTheme(config.themeMode))
        themeMode.setValue(config.themeMode)
      }
      if (config.shaderEffect) {
        setShaderEffect(config.shaderEffect)
        newtabShaderEffect.setValue(config.shaderEffect)
      }
      if (config.shaderMode) {
        setShaderMode(config.shaderMode)
        newtabShaderMode.setValue(config.shaderMode)
        if (config.shaderMode === 'random') newtabShaderRandomSeeded.setValue(true)
      }
      if (config.searchEngine) searchEngine.setValue(config.searchEngine)
      if (config.categoryLabels) {
        const nextLabels = { ...categoryLabels, ...config.categoryLabels }
        setCategoryLabels(nextLabels)
        quickNavCategoryLabels.setValue(nextLabels)
      }
      showToast(added > 0 ? `已导入 ${added} 个导航` : '没有新导航（已存在的已跳过）')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败')
    }
  }

  const shaderEffectLabel =
    SHADER_EFFECT_OPTIONS.find((item) => item.id === shaderEffect)?.label ?? '流体'
  const shaderButtonLabel = `${SHADER_MODE_LABEL[shaderMode]} · ${shaderEffectLabel}`

  return (
    // 底色在 body.quiet-page 上（见 global.css）；根容器必须保持透明，
    // 否则会盖住 -z-10 的 QuietBackground 特效层
    <div className='relative flex min-h-screen flex-col text-slate-800 dark:text-slate-100'>
      <QuietBackground effect={shaderEffect} />
      {/* 顶栏 */}
      <header className='flex items-center justify-between px-6 py-4'>
        <div className='flex items-center gap-2'>
          <img src='/icons/48.png' alt='' className='h-6 w-6' />
          <span className='text-sm font-semibold tracking-tight'>{SHIP_NAME}</span>
        </div>
        <div className='flex items-center gap-2'>
          <div ref={effectMenuRef} className='relative'>
            <button
              type='button'
              onClick={() => setEffectMenuOpen((value) => !value)}
              title='切换背景效果'
              className='flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3.5 text-sm font-medium text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 hover:shadow-md dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:border-teal-500 dark:hover:text-teal-300'
            >
              <BackgroundIcon />
              <span>{shaderButtonLabel}</span>
            </button>
            {effectMenuOpen && (
              <div className='aurora-dropdown absolute right-0 top-full z-[70] mt-2 w-64 overflow-hidden rounded-2xl p-1.5'>
                <div className='mb-1 grid grid-cols-2 gap-1 rounded-xl bg-slate-950/[0.04] p-1 dark:bg-white/[0.05]'>
                  {(['random', 'fixed'] as const).map((item) => (
                    <button
                      key={item}
                      type='button'
                      onClick={() => changeShaderMode(item)}
                      className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                        shaderMode === item
                          ? 'bg-white text-teal-700 shadow-sm dark:bg-white/10 dark:text-teal-200'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      {SHADER_MODE_LABEL[item]}
                    </button>
                  ))}
                </div>
                <div className='grid grid-cols-2 gap-1'>
                  {SHADER_EFFECT_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type='button'
                      onClick={() => changeShaderEffect(item.id)}
                      className={`aurora-dropdown-item flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm ${
                        item.id === shaderEffect ? 'is-selected' : ''
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.id === shaderEffect && (
                        <span className='h-1.5 w-1.5 rounded-full bg-teal-500' />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <ThemeSwitch mode={mode} effectiveDark={effectiveDark} onChange={changeTheme} />
        </div>
      </header>

      {/* 主体 */}
      <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 justify-center'>
        {/* 弹性留白：空间充裕时撑到 12vh（与原 mt-[12vh] 视觉一致），
            内容变多（如固定栏两行）空间不足时自动压缩，最低保留 32px 才开始滚动 */}
        <div className='mb-8 text-center'>
          <h1 className='aurora-title aurora-pan text-5xl font-extrabold tracking-tight'>
            {SHIP_NAME}
          </h1>
          <p className='mt-3 flex items-center justify-center gap-3 text-sm tracking-[0.3em] text-slate-400 dark:text-slate-500'>
            <span
              aria-hidden='true'
              className='h-px w-10 bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-600'
            />
            为开发者打造的新标签页
            <span
              aria-hidden='true'
              className='h-px w-10 bg-gradient-to-l from-transparent to-slate-300 dark:to-slate-600'
            />
          </p>
        </div>

        <div className='w-full max-w-4xl'>
          <SearchBar navItems={items} />
        </div>

        {/* 固定栏：搜索框与分类列表之间 */}
        {ready && <PinnedNav items={pinnedItems} onUnpin={togglePin} />}

        {ready && (
          <section className='mt-10 w-full'>
            <div className='mb-3 flex items-center justify-between gap-3 px-1'>
              <CategoryTabs
                active={activeCategory}
                labels={categoryLabels}
                editing={renamingCategory}
                onChange={changeCategory}
                onRename={renameCategory}
                onEditingChange={setRenamingCategory}
              />
              <div className='flex items-center gap-1.5'>
                <button
                  type='button'
                  title='重命名当前分类'
                  aria-label='重命名当前分类'
                  onClick={() => setRenamingCategory(activeCategory)}
                  className='rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200'
                >
                  <PencilIcon className='h-3.5 w-3.5' />
                </button>
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
            <div key={activeCategory} className='animate-nav-fade motion-reduce:animate-none'>
              <QuickNav
                items={items}
                activeCategory={activeCategory}
                categoryLabels={categoryLabels}
                onChange={updateItems}
                onTogglePin={togglePin}
              />
            </div>
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
