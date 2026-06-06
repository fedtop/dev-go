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

export default function App() {
  const [active, setActive] = useState('translate')

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
  }, [])

  return (
    <div className='flex w-[500px] flex-col bg-slate-50 text-slate-800'>
      {/* 顶部栏 */}
      <header className='flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3'>
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
          <kbd className='rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-500'>
            {formatShortcut('Alt+1')}
          </kbd>
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
