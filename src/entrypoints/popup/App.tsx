import { useCallback, useEffect, useRef, useState } from 'react'

import { SHIP_NAME, SITE_URL } from '@/utils/constants'
import FunctionPage from '@/features/popup/FunctionPage'
import TodoPage from '@/features/popup/TodoPage'
import NetworkPage from '@/features/popup/NetworkPage'
import ToolsPage from '@/features/popup/ToolsPage'
import TranslatePage from '@/features/popup/TranslatePage'
import { POPUP_PAGES } from '@/features/popup/pages'
import Tabs from '@/ui/Tabs'
import {
  defaultPopupTab,
  isPopupShortcutTab,
  popupInitialTab,
  type PopupShortcutTab,
} from '@/utils/settings'
import type { PopupShortcutMessage, PopupShortcutResponse } from '@/utils/messaging'
import { formatShortcut } from '@/utils/shortcut'

const DEFAULT_POPUP_COMMAND = 'open-default'
const DEFAULT_POPUP_TAB: PopupShortcutTab = 'translate'

// 各面板 -> 打开它的命令名。
const TAB_COMMANDS: Record<string, string> = {
  todo: 'open-todo',
  network: 'open-network',
  tools: 'open-tools',
}

export default function App() {
  const [active, setActive] = useState('translate')
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({})
  const [defaultShortcutTab, setDefaultShortcutTab] = useState<PopupShortcutTab>(DEFAULT_POPUP_TAB)
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

    activeRef.current = tab
    setActive(tab)
  }, [])

  // 打开面板时定位 Tab：优先一次性信号（Alt+1..4 等命令写入），否则用「功能」页配置的默认 Tab。
  useEffect(() => {
    Promise.all([popupInitialTab.getValue(), defaultPopupTab.getValue()]).then(
      ([tab, fallback]) => {
        const defaultTab = isPopupShortcutTab(fallback) ? fallback : DEFAULT_POPUP_TAB
        setDefaultShortcutTab(defaultTab)

        if (tab && isPopupShortcutTab(tab)) {
          activeRef.current = tab
          setActive(tab)
          popupInitialTab.setValue('')
          return
        }
        if (tab) popupInitialTab.setValue('')
        activeRef.current = defaultTab
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
      if (isPopupShortcutTab(tab)) setDefaultShortcutTab(tab)
    })

    return () => unwatch()
  }, [])

  useEffect(() => {
    const onMessage = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: PopupShortcutResponse) => void,
    ): boolean => {
      if (!isPopupShortcutMessage(message)) return false

      applyShortcutTab(message.tab)
      sendResponse({ handled: true })
      return false
    }

    browser.runtime.onMessage.addListener(onMessage)
    return () => browser.runtime.onMessage.removeListener(onMessage)
  }, [applyShortcutTab])

  // 当前面板对应的快捷键。
  const defaultShortcut =
    active === defaultShortcutTab ? shortcuts[DEFAULT_POPUP_COMMAND] || '' : ''
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

function isPopupShortcutMessage(message: unknown): message is PopupShortcutMessage {
  return (
    typeof message === 'object' &&
    message != null &&
    (message as PopupShortcutMessage).type === 'popup-shortcut' &&
    isPopupShortcutTab((message as PopupShortcutMessage).tab) &&
    typeof (message as PopupShortcutMessage).nonce === 'number'
  )
}
