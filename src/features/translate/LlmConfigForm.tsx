import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  findPresetByBaseUrl,
  getLlmPreset,
  isLlmConfigReady,
  requiresApiKey,
  LLM_PRESETS,
  type LlmConfig,
} from '@/features/translate/llm-config'
import { describeServiceError } from '@/features/translate/errors'
import {
  sendRuntimeMessage,
  type LlmModelListResult,
  type TranslateTestResult,
} from '@/utils/messaging'
import { translateLlmApiKey, translateLlmConfig, translateProvider } from '@/utils/settings'
import { useStorageItem } from '@/utils/useStorageItem'
import Button from '@/ui/Button'
import Combobox, { type ComboboxOption } from '@/ui/Combobox'
import Select from '@/ui/Select'

interface RemoteModels {
  /** 拉取时使用的「地址 + Key」，变化后需要重新拉取 */
  source: string
  status: 'loading' | 'done' | 'error'
  models: string[]
  error?: LlmModelListResult['error']
}

interface LlmConfigFormProps {
  /** 紧凑布局（popup 内使用）：更小的字号，自定义要求默认折叠 */
  compact?: boolean
  /** 保存成功后回调（popup 用来收起表单） */
  onSaved?: () => void
}

function Field({
  label,
  hint,
  compact,
  children,
}: {
  label: string
  hint?: ReactNode
  compact?: boolean
  children: ReactNode
}) {
  return (
    <label className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
      <span className={compact ? 'text-[11px] text-slate-400' : 'text-sm text-slate-700'}>
        {label}
      </span>
      {children}
      {hint && (
        <span className={`leading-relaxed text-slate-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {hint}
        </span>
      )}
    </label>
  )
}

/**
 * AI 翻译（OpenAI 兼容接口）配置表单：popup 翻译面板与选项页共用。
 * 编辑的是本地草稿，点击保存才写入存储 —— 避免每次按键都让已打开的页面重启翻译。
 */
export default function LlmConfigForm({ compact = false, onSaved }: LlmConfigFormProps) {
  const [savedConfig, setSavedConfig, configLoaded] = useStorageItem(translateLlmConfig)
  const [savedKey, setSavedKey, keyLoaded] = useStorageItem(translateLlmApiKey)
  const [provider, setProvider] = useStorageItem(translateProvider)

  const [draft, setDraft] = useState<LlmConfig>(savedConfig)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [showPrompt, setShowPrompt] = useState(!compact)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TranslateTestResult | null>(null)
  const [savedTip, setSavedTip] = useState('')

  useEffect(() => {
    if (!configLoaded) return
    setDraft(savedConfig)
    if (savedConfig.prompt) setShowPrompt(true)
  }, [configLoaded, savedConfig])

  useEffect(() => {
    if (keyLoaded) setApiKey(savedKey)
  }, [keyLoaded, savedKey])

  const [remote, setRemote] = useState<RemoteModels | null>(null)

  const preset = getLlmPreset(draft.preset)
  const matchedPreset = preset?.id === 'custom' ? findPresetByBaseUrl(draft.baseUrl) : preset
  const ready = isLlmConfigReady(draft)
  const modelSource = `${draft.baseUrl.trim()}\u0000${apiKey.trim()}`

  /** 模型下拉：服务端实时列表为主（常用模型排前并标注），拉取失败时用预设候选兜底 */
  const modelOptions = useMemo<ComboboxOption[]>(() => {
    const common = matchedPreset?.models ?? []
    const fetched = remote?.source === modelSource ? remote.models : []
    const ordered = [...common.filter((id) => !fetched.length || fetched.includes(id))]
    fetched.forEach((id) => {
      if (!ordered.includes(id)) ordered.push(id)
    })
    return ordered.map((id) => ({ value: id, note: common.includes(id) ? '常用' : undefined }))
  }, [matchedPreset, remote, modelSource])

  /** 远程服务没填 Key 时不发请求：必然鉴权失败，直接提示先填 Key */
  const missingKey = requiresApiKey(draft.baseUrl) && !apiKey.trim()

  const loadModels = async () => {
    if (!draft.baseUrl.trim() || missingKey) return
    if (remote?.source === modelSource && remote.status !== 'error') return

    const source = modelSource
    setRemote({ source, status: 'loading', models: [] })
    const result = await sendRuntimeMessage({
      type: 'list-llm-models',
      baseUrl: draft.baseUrl,
      apiKey: apiKey.trim(),
    })
    setRemote((current) =>
      current?.source === source
        ? {
            source,
            status: result.error ? 'error' : 'done',
            models: result.models,
            error: result.error,
          }
        : current,
    )
  }

  const modelStatus = ((): ReactNode => {
    const fallback = modelOptions.length ? '，以下为常用模型，也可直接输入' : '，可直接输入模型名'
    if (!draft.baseUrl.trim()) return '填写接口地址后可自动获取模型列表'
    if (missingKey) return `填写 API Key 后可获取完整模型列表${fallback}`
    if (remote?.source !== modelSource) return undefined
    if (remote.status === 'loading') return '正在获取模型列表…'
    if (remote.status === 'error' && remote.error) {
      return (
        <span title={remote.error.message} className='text-amber-600'>
          {remote.error.code === 'config'
            ? '该服务不支持自动获取模型列表'
            : `未能获取模型列表：${describeServiceError(remote.error.code)}`}
          {fallback}
        </span>
      )
    }
    return remote.models.length ? `共 ${remote.models.length} 个可用模型，可输入筛选` : undefined
  })()
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedConfig) || apiKey !== savedKey
  const isActiveEngine = provider === 'llm'

  const resetFeedback = () => {
    setTestResult(null)
    setSavedTip('')
  }

  const update = (patch: Partial<LlmConfig>) => {
    setDraft((current) => ({ ...current, ...patch }))
    resetFeedback()
  }

  const choosePreset = (id: string) => {
    const next = getLlmPreset(id)
    if (!next) return
    update(
      id === 'custom' ? { preset: id } : { preset: id, baseUrl: next.baseUrl, model: next.model },
    )
  }

  const save = () => {
    setSavedConfig({ ...draft, baseUrl: draft.baseUrl.trim(), model: draft.model.trim() })
    setSavedKey(apiKey.trim())
    if (!isActiveEngine) setProvider('llm')
    setSavedTip(isActiveEngine ? '已保存' : '已保存，并设为当前翻译引擎')
    onSaved?.()
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await sendRuntimeMessage({
      type: 'test-translate',
      provider: 'llm',
      llm: draft,
      apiKey: apiKey.trim(),
    })
    setTestResult(result)
    setTesting(false)
  }

  const inputClass = `popup-field w-full rounded-lg border text-slate-700 outline-none transition-colors placeholder:text-slate-400 ${
    compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'
  }`
  const buttonClass = compact ? '!px-2.5 !py-1 text-xs' : ''

  return (
    <div className={`flex flex-col ${compact ? 'gap-2.5' : 'gap-4'}`}>
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-4'}>
        <Field label='服务预设' compact={compact}>
          <Select
            value={draft.preset}
            options={LLM_PRESETS.map((item) => ({ value: item.id, label: item.label }))}
            onChange={choosePreset}
          />
        </Field>
        <Field label='模型' compact={compact}>
          <Combobox
            value={draft.model}
            options={modelOptions}
            status={modelStatus}
            placeholder='选择或输入模型名'
            onOpen={() => void loadModels()}
            onChange={(model) => update({ model })}
            inputClassName={compact ? 'py-1.5 pl-2.5 text-[13px]' : 'py-2 pl-3 text-sm'}
          />
        </Field>
      </div>

      {matchedPreset?.hint && (
        <p className={`leading-relaxed text-amber-600 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {matchedPreset.hint}
        </p>
      )}

      <Field
        label='接口地址（Base URL）'
        compact={compact}
        hint={compact ? undefined : '填到 /v1 即可，会自动补全 /chat/completions'}
      >
        <input
          className={inputClass}
          value={draft.baseUrl}
          placeholder='https://api.openai.com/v1'
          spellCheck={false}
          onChange={(e) =>
            update({
              baseUrl: e.target.value,
              preset: findPresetByBaseUrl(e.target.value)?.id ?? 'custom',
            })
          }
        />
      </Field>

      <Field label='API Key（仅存本机，不进备份）' compact={compact}>
        <div className='flex gap-2'>
          <input
            className={inputClass}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            placeholder='sk-...（本地服务可留空）'
            autoComplete='off'
            spellCheck={false}
            onChange={(e) => {
              setApiKey(e.target.value)
              resetFeedback()
            }}
          />
          <Button onClick={() => setShowKey((v) => !v)} className={`shrink-0 ${buttonClass}`}>
            {showKey ? '隐藏' : '显示'}
          </Button>
        </div>
      </Field>

      {showPrompt ? (
        <Field
          label='自定义要求（可选）'
          compact={compact}
          hint='追加到系统提示词末尾，例如术语表、语气风格：「技术文档风格；Token 不翻译」'
        >
          <textarea
            className={`${inputClass} resize-y ${compact ? 'min-h-14' : 'min-h-20'}`}
            value={draft.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
          />
        </Field>
      ) : (
        <button
          type='button'
          onClick={() => setShowPrompt(true)}
          className='self-start text-[11px] text-slate-400 transition-colors hover:text-indigo-600'
        >
          + 自定义要求（术语表、语气风格）
        </button>
      )}

      <div className='flex flex-wrap items-center gap-2'>
        <Button
          onClick={() => void test()}
          loading={testing}
          disabled={!ready}
          className={buttonClass}
        >
          测试连接
        </Button>
        <Button
          variant='primary'
          onClick={save}
          disabled={!ready || (!dirty && isActiveEngine)}
          className={buttonClass}
        >
          {isActiveEngine ? '保存' : '保存并设为翻译引擎'}
        </Button>
        {savedTip && <span className='text-xs text-emerald-600'>{savedTip}</span>}
      </div>

      {testResult && (
        <div
          className={`rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
            testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {testResult.ok ? (
            `连接成功：Hello, world! → ${testResult.sample}`
          ) : (
            <span title={testResult.error?.message}>
              连接失败：
              {testResult.error ? describeServiceError(testResult.error.code) : '未知错误'}
              {testResult.error?.code === 'auth' && '。若刚切换了服务预设，请确认 Key 来自该服务'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
