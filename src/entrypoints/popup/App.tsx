import { useCallback, useEffect, useRef, useState } from 'react'

import { SHIP_NAME, SITE_URL } from '@/utils/constants'
import FunctionPage from '@/features/popup/FunctionPage'
import NetworkPage from '@/features/popup/NetworkPage'
import ToolsPage from '@/features/popup/ToolsPage'
import TranslatePage from '@/features/popup/TranslatePage'
import { POPUP_PAGES } from '@/features/popup/pages'
import Tabs from '@/ui/Tabs'
import {
  defaultPopupTab,
  isPopupShortcutTab,
  popupLastActiveTab,
  popupInitialTab,
  type PopupShortcutTab,
} from '@/utils/settings'
import type { PopupShortcutMessage, PopupShortcutResponse } from '@/utils/messaging'
import { formatShortcut } from '@/utils/shortcut'

const DEFAULT_POPUP_COMMAND = 'open-default'
const DEFAULT_POPUP_TAB: PopupShortcutTab = 'translate'

// 各面板 -> 打开它的命令名。
const TAB_COMMANDS: Record<string, string> = {
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

  const selectTab = useCallback((tab: PopupShortcutTab) => {
    activeRef.current = tab
    setActive(tab)
    void popupLastActiveTab.setValue(tab)
  }, [])

  const applyShortcutTab = useCallback(
    (tab: PopupShortcutTab) => {
      popupInitialTab.setValue('')

      if (activeRef.current === tab) {
        window.close()
        return
      }

      selectTab(tab)
    },
    [selectTab],
  )

  // 打开面板时定位 Tab：优先一次性快捷键指令，其次恢复上次选中项，最后使用默认 Tab。
  useEffect(() => {
    Promise.all([
      popupInitialTab.getValue(),
      popupLastActiveTab.getValue(),
      defaultPopupTab.getValue(),
    ]).then(([tab, lastActiveTab, fallback]) => {
      const defaultTab = isPopupShortcutTab(fallback) ? fallback : DEFAULT_POPUP_TAB
      setDefaultShortcutTab(defaultTab)

      if (tab && isPopupShortcutTab(tab)) {
        selectTab(tab)
        popupInitialTab.setValue('')
        return
      }
      if (tab) popupInitialTab.setValue('')
      selectTab(isPopupShortcutTab(lastActiveTab) ? lastActiveTab : defaultTab)
    })

    // 读取实际注册的命令快捷键（用户在 chrome://extensions/shortcuts 改动后会同步）
    browser.commands?.getAll().then((cmds) => {
      setShortcuts(Object.fromEntries(cmds.map((c) => [c.name, c.shortcut || ''])))
    })
  }, [selectTab])

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

  const handleTabChange = (tab: string) => {
    if (isPopupShortcutTab(tab)) selectTab(tab)
  }

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
        <Tabs value={active} tabs={POPUP_PAGES} onChange={handleTabChange} />
      </header>

      {/* 内容区 */}
      <main className='popup-main min-h-0 flex-auto overflow-y-auto overscroll-contain px-4 py-4'>
        {active === 'translate' && <TranslatePage />}
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
