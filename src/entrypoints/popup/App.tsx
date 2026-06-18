import { useCallback, useEffect, useRef, useState } from 'react'

import { SHIP_NAME, SITE_URL } from '@/utils/constants'
import FunctionPage from '@/features/popup/FunctionPage'
import TodoPage from '@/features/popup/TodoPage'
import NetworkPage from '@/features/popup/NetworkPage'
import ToolsPage from '@/features/popup/ToolsPage'
import TranslatePage from '@/features/popup/TranslatePage'
import { POPUP_PAGES, POPUP_PAGE_VALUES } from '@/features/popup/pages'
import Tabs from '@/ui/Tabs'
import {
  defaultPopupTab,
  popupInitialTab,
  popupOpenState,
  popupShortcutSignal,
  type PopupShortcutTab,
} from '@/utils/settings'
import { formatShortcut } from '@/utils/shortcut'

const FIXED_SHORTCUT_TABS: Record<string, PopupShortcutTab> = {
  Digit2: 'todo',
  Digit3: 'network',
  Digit4: 'tools',
}
const EXECUTE_ACTION_COMMAND = '_execute_action'

// 各面板 -> 打开它的命令名。
const TAB_COMMANDS: Record<string, string> = {
  todo: 'open-todo',
  network: 'open-network',
  tools: 'open-tools',
}

export default function App() {
  const [active, setActive] = useState('translate')
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({})
  const [defaultShortcutTab, setDefaultShortcutTab] = useState('translate')
  const openedAtRef = useRef(Date.now())
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  const applyShortcutTab = useCallback((tab: PopupShortcutTab) => {
    popupInitialTab.setValue('')

    if (activeRef.current === tab) {
      window.close()
      return
    }

    setActive(tab)
  }, [])

  useEffect(() => {
    const markOpen = () => popupOpenState.setValue({ open: true, updatedAt: Date.now() })
    const markClosed = () => popupOpenState.setValue({ open: false, updatedAt: Date.now() })

    markOpen()
    const heartbeat = window.setInterval(markOpen, 1500)
    window.addEventListener('pagehide', markClosed)
    window.addEventListener('beforeunload', markClosed)

    return () => {
      window.clearInterval(heartbeat)
      window.removeEventListener('pagehide', markClosed)
      window.removeEventListener('beforeunload', markClosed)
      markClosed()
    }
  }, [])

  // 打开面板时定位 Tab：优先一次性信号（Alt+2..4 等命令写入），否则用「功能」页配置的默认 Tab。
  useEffect(() => {
    Promise.all([popupInitialTab.getValue(), defaultPopupTab.getValue()]).then(
      ([tab, fallback]) => {
        const defaultTab = POPUP_PAGE_VALUES.has(fallback) ? fallback : 'translate'
        setDefaultShortcutTab(defaultTab)

        if (tab && POPUP_PAGE_VALUES.has(tab)) {
          setActive(tab)
          popupInitialTab.setValue('')
          return
        }
        if (tab) popupInitialTab.setValue('')
        setActive(defaultTab)
      },
    )

    // 读取实际注册的命令快捷键（用户在 chrome://extensions/shortcuts 改动后会同步）
    browser.commands?.getAll().then((cmds) => {
      setShortcuts(Object.fromEntries(cmds.map((c) => [c.name, c.shortcut || ''])))
    })
  }, [])

  useEffect(() => {
    const unwatch = defaultPopupTab.watch((tab) => {
      if (POPUP_PAGE_VALUES.has(tab)) setDefaultShortcutTab(tab)
    })

    return () => unwatch()
  }, [])

  useEffect(() => {
    const unwatch = popupShortcutSignal.watch((signal) => {
      if (!signal || !POPUP_PAGE_VALUES.has(signal.tab)) return
      if (signal.nonce <= openedAtRef.current) return
      applyShortcutTab(signal.tab)
    })

    return () => unwatch()
  }, [applyShortcutTab])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

      const tab = event.code === 'Digit1' ? defaultShortcutTab : FIXED_SHORTCUT_TABS[event.code]
      if (!tab) return

      event.preventDefault()
      event.stopPropagation()
      applyShortcutTab(tab as PopupShortcutTab)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [applyShortcutTab, defaultShortcutTab])

  // 当前面板对应的快捷键。
  const defaultShortcut =
    active === defaultShortcutTab ? shortcuts[EXECUTE_ACTION_COMMAND] || '' : ''
  const activeShortcut = shortcuts[TAB_COMMANDS[active]] || defaultShortcut

  return (
    <div className='popup-shell relative flex w-[500px] flex-col overflow-hidden text-slate-800'>
      <span aria-hidden='true' className='popup-ambient popup-ambient-a' />
      <span aria-hidden='true' className='popup-ambient popup-ambient-b' />

      {/* 顶部栏 */}
      <header className='popup-header z-10 flex shrink-0 items-center justify-between px-4 py-3'>
        <div className='flex items-center gap-2'>
          <span className='popup-brand-mark flex h-7 w-7 items-center justify-center rounded-xl'>
            <img src='/icons/48.png' alt='' className='h-5 w-5' />
          </span>
          <span className='text-sm font-semibold tracking-tight text-slate-800'>{SHIP_NAME}</span>
        </div>
        <Tabs value={active} tabs={POPUP_PAGES} onChange={setActive} />
      </header>

      {/* 内容区 */}
      <main className='popup-main min-h-0 flex-auto overflow-y-auto overscroll-contain px-4 py-4'>
        {active === 'translate' && <TranslatePage />}
        {active === 'todo' && <TodoPage />}
        {active === 'network' && <NetworkPage />}
        {active === 'tools' && <ToolsPage />}
        {active === 'function' && <FunctionPage />}
      </main>

      {/* 底部栏 */}
      <footer className='popup-footer flex shrink-0 items-center justify-between px-4 py-2 text-xs text-slate-400'>
        <span>
          快捷键{' '}
          {activeShortcut ? (
            <kbd className='popup-kbd rounded px-1.5 py-0.5 text-[10px] text-slate-500'>
              {formatShortcut(activeShortcut)}
            </kbd>
          ) : (
            <span className='text-[10px] text-slate-400'>未设置</span>
          )}
        </span>
        <a
          href={SITE_URL}
          target='_blank'
          rel='noreferrer'
          className='transition-colors hover:text-indigo-600'
        >
          GitHub ↗
        </a>
      </footer>
    </div>
  )
}
