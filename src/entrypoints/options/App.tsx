import { useEffect, useState, type ComponentType } from 'react'

import AiModelSettings from '@/features/options/AiModelSettings'
import AssistantSettings from '@/features/options/AssistantSettings'
import EnhanceSettings from '@/features/options/EnhanceSettings'
import GeneralSettings from '@/features/options/GeneralSettings'
import PrivacySettings from '@/features/options/PrivacySettings'
import SelectionSettings from '@/features/options/SelectionSettings'
import NetworkSettings from '@/features/network/NetworkSettings'
import TranslateSettings from '@/features/options/TranslateSettings'
import { SHIP_NAME, SITE_URL } from '@/utils/constants'

interface Section {
  id: string
  label: string
  icon: string
  component: ComponentType
}

const SECTIONS: Section[] = [
  { id: 'translate', label: '翻译', icon: '🌐', component: TranslateSettings },
  { id: 'models', label: 'AI 模型', icon: '🧠', component: AiModelSettings },
  { id: 'selection', label: '划词', icon: '✍️', component: SelectionSettings },
  { id: 'assistant', label: 'AI 助手', icon: '💬', component: AssistantSettings },
  { id: 'network', label: '网络代理', icon: '🛜', component: NetworkSettings },
  { id: 'privacy', label: '隐私防护', icon: '🛡️', component: PrivacySettings },
  { id: 'enhance', label: '网页增强', icon: '🧩', component: EnhanceSettings },
  { id: 'general', label: '通用', icon: '⚙️', component: GeneralSettings },
]

/** 当前分区记在地址的 hash 里：刷新、从其他页面直达（options.html#models）都能定位 */
function readSection(): string {
  const id = location.hash.slice(1)
  return SECTIONS.some((section) => section.id === id) ? id : SECTIONS[0].id
}

export default function App() {
  const [current, setCurrent] = useState(readSection)

  useEffect(() => {
    const onHashChange = () => {
      setCurrent(readSection())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const Active = SECTIONS.find((section) => section.id === current)?.component ?? TranslateSettings

  return (
    <div className='popup-shell min-h-screen !max-h-none'>
      <div className='mx-auto flex max-w-5xl gap-8 px-6 py-10'>
        <aside className='sticky top-10 flex h-fit w-48 shrink-0 flex-col gap-6'>
          <div className='flex items-center gap-2 px-2'>
            <img src='/icons/48.png' alt='' className='h-7 w-7' />
            <span className='text-lg font-semibold text-slate-800'>{SHIP_NAME} 设置</span>
          </div>
          <nav className='flex flex-col gap-1'>
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={section.id === current ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  section.id === current
                    ? 'bg-white font-medium text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'
                }`}
              >
                <span aria-hidden>{section.icon}</span>
                {section.label}
              </a>
            ))}
          </nav>
          <a
            href={SITE_URL}
            target='_blank'
            rel='noreferrer'
            className='px-3 text-xs text-slate-400 transition-colors hover:text-indigo-600'
          >
            GitHub ↗
          </a>
        </aside>

        <main className='min-w-0 flex-1'>
          <Active />
        </main>
      </div>
    </div>
  )
}
