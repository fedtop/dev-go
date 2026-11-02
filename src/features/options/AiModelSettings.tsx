import { useState, type ReactNode } from 'react'

import { resolveChatModel } from '@/features/ai/model'
import {
  findPresetByBaseUrl,
  getLlmPreset,
  isLlmConfigReady,
  requiresApiKey,
  type LlmConfig,
} from '@/features/translate/llm-config'
import LlmConfigForm from '@/features/translate/LlmConfigForm'
import Button from '@/ui/Button'
import {
  assistantLlmApiKey,
  assistantLlmConfig,
  translateLlmApiKey,
  translateLlmConfig,
} from '@/utils/settings'
import { useStorageItem } from '@/utils/useStorageItem'

import { SectionHeader } from './layout'

/** 当前配置的一行摘要：服务 · 模型 · Key 状态 */
function ConfigSummary({ config, apiKey }: { config: LlmConfig; apiKey: string }) {
  if (!isLlmConfigReady(config)) {
    return <span className='text-amber-600'>还没有配置</span>
  }
  const preset = getLlmPreset(config.preset)
  const service = (preset?.id === 'custom' ? findPresetByBaseUrl(config.baseUrl) : preset)?.label
  const missingKey = requiresApiKey(config.baseUrl) && !apiKey.trim()

  return (
    <span className='flex flex-wrap items-center gap-x-2 gap-y-0.5'>
      {service && <span>{service}</span>}
      <span className='rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-700'>
        {config.model}
      </span>
      {missingKey && <span className='text-amber-600'>缺少 API Key</span>}
    </span>
  )
}

function ModelCard({
  title,
  badge,
  desc,
  summary,
  children,
}: {
  title: string
  badge: { text: string; tone: 'fast' | 'smart' }
  desc: ReactNode
  summary: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <section
      className={`rounded-xl border bg-white/90 shadow-sm transition-colors ${
        open ? 'border-indigo-200' : 'border-slate-200'
      }`}
    >
      <div className='flex items-start justify-between gap-4 p-5'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <h2 className='text-base font-semibold text-slate-800'>{title}</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                badge.tone === 'fast'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              {badge.text}
            </span>
          </div>
          <p className='mt-1 text-xs leading-relaxed text-slate-400'>{desc}</p>
          <div className='mt-2.5 text-sm text-slate-500'>{summary}</div>
        </div>
        <Button
          variant={open ? 'default' : 'primary'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className='shrink-0 !px-3.5 !py-1.5 text-sm'
        >
          {open ? '收起 ▴' : '配置 ▾'}
        </Button>
      </div>
      {open && <div className='border-t border-slate-100 px-5 pt-4 pb-5'>{children}</div>}
    </section>
  )
}

/** 设置页：AI 模型（翻译模型与对话模型分开配置） */
export default function AiModelSettings() {
  const [translateConfig] = useStorageItem(translateLlmConfig)
  const [translateKey] = useStorageItem(translateLlmApiKey)
  const [assistantConfig, setAssistantConfig] = useStorageItem(assistantLlmConfig)
  const [assistantKey, setAssistantKey] = useStorageItem(assistantLlmApiKey)
  const chatModel = resolveChatModel(assistantConfig, assistantKey, translateConfig, translateKey)

  return (
    <div className='flex flex-col gap-5'>
      <SectionHeader
        title='AI 模型'
        desc='支持任意 OpenAI 兼容接口（含各家 Coding Plan）。翻译和对话分开配置：翻译要快，对话要强。'
      />

      <ModelCard
        title='翻译模型'
        badge={{ text: '追求速度', tone: 'fast' }}
        desc='整页 / 悬停 / 划词翻译，翻译引擎选「AI 大模型」时生效。建议选不带深度思考的快模型，如 glm-4-flash、qwen-turbo、deepseek-chat。'
        summary={<ConfigSummary config={translateConfig} apiKey={translateKey} />}
      >
        <LlmConfigForm />
      </ModelCard>

      <ModelCard
        title='对话模型'
        badge={{ text: '追求能力', tone: 'smart' }}
        desc='划词解释 / 总结 / 润色与侧边栏 AI 助手。建议选能力强、支持工具调用的模型，如 GLM-4.6、Kimi K2、qwen3-max 或 Coding Plan。'
        summary={
          <span className='flex flex-wrap items-center gap-x-2'>
            <ConfigSummary config={chatModel.config} apiKey={chatModel.apiKey} />
            {chatModel.inherited && <span className='text-slate-400'>（沿用翻译模型）</span>}
          </span>
        }
      >
        <div className='flex flex-col gap-4'>
          <LlmConfigForm target='assistant' />
          {!chatModel.inherited && (
            <div className='flex items-center justify-between gap-4 border-t border-slate-100 pt-3'>
              <span className='text-xs text-slate-400'>
                不想单独维护一套配置时，可以改回沿用翻译模型
              </span>
              <Button
                onClick={() => {
                  setAssistantConfig(null)
                  setAssistantKey('')
                }}
                className='shrink-0 !px-2.5 !py-1 text-xs'
              >
                改回沿用翻译模型
              </Button>
            </div>
          )}
        </div>
      </ModelCard>
    </div>
  )
}
