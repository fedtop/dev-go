import { useEffect, useState } from 'react'

import { SHIP_NAME, SITE_URL } from '@/utils/constants'
import FunctionPage from '@/features/popup/FunctionPage'
import TodoPage from '@/features/popup/TodoPage'
import NetworkPage from '@/features/popup/NetworkPage'
import ToolsPage from '@/features/popup/ToolsPage'
import TranslatePage from '@/features/popup/TranslatePage'
import { POPUP_PAGES, POPUP_PAGE_VALUES } from '@/features/popup/pages'
import Tabs from '@/ui/Tabs'
import { defaultPopupTab, popupInitialTab } from '@/utils/settings'
import { formatShortcut } from '@/utils/shortcut'

// 各面板 -> 打开它的命令名。翻译/功能没有独立命令，回退到 _execute_action（打开面板）。
const TAB_COMMANDS: Record<string, string> = {
  todo: 'open-todo',
  network: 'open-network',
  tools: 'open-tools',
}

export default function App() {
  const [active, setActive] = useState('translate')
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({})

  // 打开面板时定位 Tab：优先一次性信号（Alt+2 等命令写入），否则用「功能」页配置的默认 Tab。
  useEffect(() => {
    popupInitialTab.getValue().then((tab) => {
      if (tab && POPUP_PAGE_VALUES.has(tab)) {
        setActive(tab)
        popupInitialTab.setValue('')
        return
      }
      if (tab) popupInitialTab.setValue('')
      defaultPopupTab.getValue().then((fallback) => {
        if (POPUP_PAGE_VALUES.has(fallback)) setActive(fallback)
      })
    })

    // 读取实际注册的命令快捷键（用户在 chrome://extensions/shortcuts 改动后会同步）
    browser.commands?.getAll().then((cmds) => {
      setShortcuts(Object.fromEntries(cmds.map((c) => [c.name, c.shortcut || ''])))
    })
  }, [])

  // 当前面板对应的快捷键：有独立命令用其快捷键，否则回退到打开面板的 _execute_action。
  // eslint-disable-next-line no-underscore-dangle -- _execute_action 是 Chrome 内置命令名，不可改名
  const activeShortcut = shortcuts[TAB_COMMANDS[active]] || shortcuts._execute_action || ''

  return (
    <div className='flex w-[500px] flex-col bg-slate-50 text-slate-800'>
      {/* 顶部栏 */}
      <header className='sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3'>
        <div className='flex items-center gap-2'>
          <img src='/icons/48.png' alt='' className='h-5 w-5' />
          <span className='text-sm font-semibold tracking-tight text-slate-800'>{SHIP_NAME}</span>
        </div>
        <Tabs value={active} tabs={POPUP_PAGES} onChange={setActive} />
      </header>

      {/* 内容区 */}
      <main className='px-4 py-4'>
        {active === 'translate' && <TranslatePage />}
        {active === 'todo' && <TodoPage />}
        {active === 'network' && <NetworkPage />}
        {active === 'tools' && <ToolsPage />}
        {active === 'function' && <FunctionPage />}
      </main>

      {/* 底部栏 */}
      <footer className='flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-400'>
        <span>
          快捷键{' '}
          {activeShortcut ? (
            <kbd className='rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-500'>
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
          className='transition-colors hover:text-blue-600'
        >
          GitHub ↗
        </a>
      </footer>
    </div>
  )
}
