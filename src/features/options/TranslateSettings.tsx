import { useState, type ReactNode } from 'react'

import LlmConfigForm from '@/features/translate/LlmConfigForm'
import { TARGET_LANGUAGE_OPTIONS } from '@/features/translate/languages'
import type { TranslateTargetSetting } from '@/features/translate/languages'
import {
  describeHoverMode,
  DISPLAY_MODE_OPTIONS,
  HOVER_MODE_OPTIONS,
  PROVIDER_OPTIONS,
} from '@/features/translate/ui-options'
import {
  hoverTranslateMode,
  translateAutoHosts,
  translateDisplayMode,
  translateProvider,
  translateTargetLang,
  translateUnderline,
  type HoverTranslateMode,
  type TranslateDisplayMode,
  type TranslateProvider,
} from '@/utils/settings'
import { useStorageItem } from '@/utils/useStorageItem'
import Button from '@/ui/Button'
import Select from '@/ui/Select'
import Switch from '@/ui/Switch'
import Tabs from '@/ui/Tabs'

const INPUT_CLASS =
  'popup-field w-full rounded-lg border px-3 py-2 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400'

function Card({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className='rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm'>
      <h2 className='text-base font-semibold text-slate-800'>{title}</h2>
      {desc && <p className='mt-1 text-xs leading-relaxed text-slate-400'>{desc}</p>}
      <div className='mt-4 flex flex-col gap-4'>{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className='flex items-center justify-between gap-6'>
      <div className='flex min-w-0 flex-col'>
        <span className='text-sm text-slate-700'>{label}</span>
        {hint && <span className='text-xs text-slate-400'>{hint}</span>}
      </div>
      <div className='shrink-0'>{children}</div>
    </div>
  )
}

function GeneralSettings() {
  const [provider, setProvider] = useStorageItem(translateProvider)
  const [target, setTarget] = useStorageItem(translateTargetLang)
  const [displayMode, setDisplayMode] = useStorageItem(translateDisplayMode)
  const [underline, setUnderline] = useStorageItem(translateUnderline)
  const [hoverMode, setHoverMode] = useStorageItem(hoverTranslateMode)

  return (
    <Card title='网页翻译' desc='整页双语对照翻译：译文插在原文段落之后，随页面滚动按需翻译。'>
      <Row label='翻译引擎' hint='AI 大模型需在下方配置接口'>
        <Select
          value={provider}
          options={PROVIDER_OPTIONS}
          onChange={(value) => setProvider(value as TranslateProvider)}
          className='w-44'
        />
      </Row>
      <Row label='目标语言' hint='自动：中文页面译成英文，其余页面译成简体中文'>
        <Select
          value={target}
          options={TARGET_LANGUAGE_OPTIONS}
          onChange={(value) => setTarget(value as TranslateTargetSetting)}
          className='w-44'
        />
      </Row>
      <Row label='展示方式' hint='仅译文：隐藏原文，只保留译文'>
        <Tabs
          value={displayMode}
          tabs={DISPLAY_MODE_OPTIONS}
          onChange={(value) => setDisplayMode(value as TranslateDisplayMode)}
        />
      </Row>
      <Row label='译文下划线' hint='用虚线标出译文，方便区分原文'>
        <Switch checked={underline} onChange={setUnderline} />
      </Row>
      <Row label='悬停翻译' hint={describeHoverMode(hoverMode)}>
        <Select
          value={hoverMode}
          options={HOVER_MODE_OPTIONS}
          onChange={(value) => setHoverMode(value as HoverTranslateMode)}
          className='w-44'
        />
      </Row>
    </Card>
  )
}

function LlmSettings() {
  return (
    <Card
      title='AI 大模型翻译'
      desc='支持任意 OpenAI 兼容接口（POST /chat/completions，流式输出）。也可以直接在弹窗的翻译面板里配置。'
    >
      <LlmConfigForm />
    </Card>
  )
}

function AutoHostsSettings() {
  const [hosts, setHosts] = useStorageItem(translateAutoHosts)
  const [input, setInput] = useState('')

  const add = () => {
    const raw = input.trim()
    if (!raw) return
    let host = raw
    try {
      host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname
    } catch {
      return
    }
    setHosts([...new Set([...hosts, host])])
    setInput('')
  }

  return (
    <Card title='总是翻译的网站' desc='打开这些网站时自动整页翻译。也可在弹窗中一键开关当前网站。'>
      <div className='flex gap-2'>
        <input
          className={INPUT_CLASS}
          value={input}
          placeholder='例如 developer.mozilla.org'
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button onClick={add} className='shrink-0'>
          添加
        </Button>
      </div>
      {hosts.length > 0 ? (
        <ul className='flex flex-wrap gap-2'>
          {hosts.map((host) => (
            <li
              key={host}
              className='flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-xs text-slate-600'
            >
              {host}
              <button
                type='button'
                aria-label={`移除 ${host}`}
                onClick={() => setHosts(hosts.filter((item) => item !== host))}
                className='flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600'
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className='text-xs text-slate-400'>暂无</p>
      )}
    </Card>
  )
}

/** 选项页：翻译设置 */
export default function TranslateSettings() {
  return (
    <div className='flex flex-col gap-5'>
      <GeneralSettings />
      <LlmSettings />
      <AutoHostsSettings />
    </div>
  )
}
