import { useState } from 'react'

import { SHIP_NAME, SITE_URL } from '@/utils/constants'
import FunctionPage from '@/features/popup/FunctionPage'
import ToolsPage from '@/features/popup/ToolsPage'
import TranslatePage from '@/features/popup/TranslatePage'
import Tabs from '@/ui/Tabs'
import { formatShortcut } from '@/utils/shortcut'

const pages = [
  { value: 'translate', label: '翻译' },
  { value: 'tools', label: '工具' },
  { value: 'function', label: '功能' },
]

export default function App() {
  const [active, setActive] = useState('translate')

  return (
    <div className='flex w-[420px] flex-col bg-slate-50 text-slate-800'>
      {/* 顶部栏 */}
      <header className='flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3'>
        <div className='flex items-center gap-2'>
          <img src='/icons/48.png' alt='' className='h-5 w-5' />
          <span className='text-sm font-semibold tracking-tight text-slate-800'>{SHIP_NAME}</span>
        </div>
        <Tabs value={active} tabs={pages} onChange={setActive} />
      </header>

      {/* 内容区 */}
      <main className='px-4 py-4'>
        {active === 'translate' && <TranslatePage />}
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
