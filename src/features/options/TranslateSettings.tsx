import { useState } from 'react'

import { TARGET_LANGUAGE_OPTIONS } from '@/features/translate/languages'
import type { TranslateTargetSetting } from '@/features/translate/languages'
import {
  describeHoverMode,
  DISPLAY_MODE_OPTIONS,
  HOVER_MODE_OPTIONS,
  PROVIDER_OPTIONS,
} from '@/features/translate/ui-options'
import { isLlmConfigReady } from '@/features/translate/llm-config'
import {
  hoverTranslateMode,
  translateLlmConfig,
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

import { Card, INPUT_CLASS, Row, SectionHeader } from './layout'

/** 跳到「AI 模型」分区 */
function ModelLink({ label }: { label: string }) {
  return (
    <a href='#models' className='ml-1.5 text-indigo-600 hover:underline'>
      {label} →
    </a>
  )
}

function GeneralSettings() {
  const [provider, setProvider] = useStorageItem(translateProvider)
  const [target, setTarget] = useStorageItem(translateTargetLang)
  const [displayMode, setDisplayMode] = useStorageItem(translateDisplayMode)
  const [underline, setUnderline] = useStorageItem(translateUnderline)
  const [hoverMode, setHoverMode] = useStorageItem(hoverTranslateMode)
  const [llmConfig] = useStorageItem(translateLlmConfig)
  const llmReady = isLlmConfigReady(llmConfig)

  return (
    <Card title='网页翻译' desc='整页双语对照翻译：译文插在原文段落之后，随页面滚动按需翻译。'>
      <Row
        label='翻译引擎'
        hint={
          provider === 'llm' ? (
            <>
              {llmReady ? (
                <>使用翻译模型 {llmConfig.model}</>
              ) : (
                <span className='text-amber-600'>还没有配置翻译模型，AI 翻译暂时不可用</span>
              )}
              <ModelLink label={llmReady ? '修改' : '去配置'} />
            </>
          ) : (
            <>
              谷歌、微软免费可用；想用大模型翻译可配置自己的模型
              <ModelLink label='配置 AI 模型' />
            </>
          )
        }
      >
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

/** 设置页：翻译 */
export default function TranslateSettings() {
  return (
    <div className='flex flex-col gap-5'>
      <SectionHeader title='翻译' desc='整页双语翻译、悬停翻译与总是翻译的网站' />
      <GeneralSettings />
      <AutoHostsSettings />
    </div>
  )
}
