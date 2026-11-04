import {
  Brain,
  Globe,
  Languages,
  MessageSquare,
  Puzzle,
  Settings,
  ShieldCheck,
  TextSelect,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'

import AiModelSettings from '@/features/options/AiModelSettings'
import AssistantSettings from '@/features/options/AssistantSettings'
import EnhanceSettings from '@/features/options/EnhanceSettings'
import GeneralSettings from '@/features/options/GeneralSettings'
import PrivacySettings from '@/features/options/PrivacySettings'
import SelectionSettings from '@/features/options/SelectionSettings'
import NetworkSettings from '@/features/network/NetworkSettings'
import TranslateSettings from '@/features/options/TranslateSettings'
import GithubMark from '@/ui/GithubMark'
import { SHIP_NAME, SITE_URL } from '@/utils/constants'

interface Section {
  id: string
  label: string
  icon: LucideIcon
  component: ComponentType
}

const SECTIONS: Section[] = [
  { id: 'translate', label: '翻译', icon: Languages, component: TranslateSettings },
  { id: 'models', label: 'AI 模型', icon: Brain, component: AiModelSettings },
  { id: 'selection', label: '划词', icon: TextSelect, component: SelectionSettings },
  { id: 'assistant', label: 'AI 助手', icon: MessageSquare, component: AssistantSettings },
  { id: 'network', label: '网络代理', icon: Globe, component: NetworkSettings },
  { id: 'privacy', label: '隐私防护', icon: ShieldCheck, component: PrivacySettings },
  { id: 'enhance', label: '网页增强', icon: Puzzle, component: EnhanceSettings },
  { id: 'general', label: '通用', icon: Settings, component: GeneralSettings },
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
    <div className='popup-shell flex min-h-screen !max-h-none'>
      <aside className='sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-black/5 bg-[var(--ui-bg-sidebar)] px-3 py-5'>
        <div className='flex items-center gap-2 px-2.5 pb-5'>
          <img src='/icons/48.png' alt='' className='h-6 w-6' />
          <span className='text-[15px] font-semibold tracking-tight text-neutral-900'>
            {SHIP_NAME} 设置
          </span>
        </div>
        <nav className='flex flex-col gap-0.5'>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={id === current ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                id === current
                  ? 'bg-black/[0.07] font-medium text-neutral-900'
                  : 'text-neutral-600 hover:bg-black/5 hover:text-neutral-900'
              }`}
            >
              <Icon className='size-4 shrink-0' strokeWidth={1.8} aria-hidden />
              {label}
            </a>
          ))}
        </nav>
        <a
          href={SITE_URL}
          target='_blank'
          rel='noreferrer'
          className='mt-auto flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900'
        >
          <GithubMark className='size-4' />
          GitHub
        </a>
      </aside>

      <main className='min-w-0 flex-1 px-10 py-10'>
        <div className='mx-auto max-w-3xl'>
          <Active />
        </div>
      </main>
    </div>
  )
}
