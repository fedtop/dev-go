import { useEffect, useState } from 'react'

import LlmConfigForm from '@/features/translate/LlmConfigForm'
import { isLlmConfigReady, requiresApiKey, type LlmConfig } from '@/features/translate/llm-config'
import { TARGET_LANGUAGE_OPTIONS } from '@/features/translate/languages'
import {
  describeHoverMode,
  DISPLAY_MODE_OPTIONS,
  HOVER_MODE_OPTIONS,
  PROVIDER_OPTIONS,
} from '@/features/translate/ui-options'
import { sendTabRequest } from '@/utils/messaging'
import {
  hoverTranslateMode,
  translateAutoHosts,
  translateDisplayMode,
  translateLlmApiKey,
  translateLlmConfig,
  translateProvider,
  translateTargetLang,
  translateUnderline,
  type HoverTranslateMode,
  type TranslateDisplayMode,
  type TranslateProvider,
} from '@/utils/settings'
import type { TranslateTargetSetting } from '@/features/translate/languages'
import { useStorageItem } from '@/utils/useStorageItem'
import Button from '@/ui/Button'
import Select from '@/ui/Select'
import Switch from '@/ui/Switch'
import Tabs from '@/ui/Tabs'
import { getActiveHostname } from '@/utils/tabs'

function openOptionsPage() {
  void browser.runtime.openOptionsPage()
  window.close()
}

/** AI 配置是否可用：地址、模型已填；非本地服务还需要 API Key */
function isLlmUsable(config: LlmConfig, apiKey: string): boolean {
  return isLlmConfigReady(config) && (Boolean(apiKey.trim()) || !requiresApiKey(config.baseUrl))
}

function describeLlmService(config: LlmConfig): string {
  try {
    return `${config.model} · ${new URL(config.baseUrl).hostname}`
  } catch {
    return config.model
  }
}

/** 引擎为 AI 大模型时的内联配置区：未配置时直接展开表单，已配置时折叠为摘要 */
function LlmPanel({ needsSetup }: { needsSetup: boolean }) {
  const [config] = useStorageItem(translateLlmConfig)
  const [editing, setEditing] = useState(false)
  const expanded = needsSetup || editing

  return (
    <div className='rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-col'>
          <span className='text-xs font-medium text-slate-700'>AI 模型配置</span>
          <span
            className={`truncate text-[11px] ${needsSetup ? 'text-amber-600' : 'text-slate-400'}`}
          >
            {needsSetup ? '填写接口地址、模型和 API Key 后即可使用' : describeLlmService(config)}
          </span>
        </div>
        {!needsSetup && (
          <button
            type='button'
            onClick={() => setEditing((value) => !value)}
            className='shrink-0 text-xs text-indigo-500 transition-colors hover:text-indigo-700'
          >
            {editing ? '收起' : '修改'}
          </button>
        )}
      </div>
      {expanded && (
        <div className='mt-2.5 border-t border-indigo-100 pt-2.5'>
          <LlmConfigForm compact onSaved={() => setEditing(false)} />
        </div>
      )}
    </div>
  )
}

/** popup「翻译」页的整页翻译面板 */
export default function PageTranslatePanel() {
  const [provider, setProvider] = useStorageItem(translateProvider)
  const [target, setTarget] = useStorageItem(translateTargetLang)
  const [displayMode, setDisplayMode] = useStorageItem(translateDisplayMode)
  const [hoverMode, setHoverMode] = useStorageItem(hoverTranslateMode)
  const [autoHosts, setAutoHosts] = useStorageItem(translateAutoHosts)
  const [underline, setUnderline] = useStorageItem(translateUnderline)
  const [llmConfig] = useStorageItem(translateLlmConfig)
  const [llmApiKey] = useStorageItem(translateLlmApiKey)

  const [hostname, setHostname] = useState('')
  /** null：当前页面无法注入内容脚本（浏览器内置页、扩展商店等） */
  const [pageActive, setPageActive] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getActiveHostname().then(setHostname)
    sendTabRequest({ type: 'get-page-translation-state' }).then((state) => {
      setPageActive(state ? state.active : null)
    })
  }, [])

  const llmMissing = provider === 'llm' && !isLlmUsable(llmConfig, llmApiKey)
  const alwaysTranslate = Boolean(hostname) && autoHosts.includes(hostname)
  const unsupported = pageActive === null

  const togglePage = async () => {
    setBusy(true)
    const state = await sendTabRequest({ type: 'translate-page' })
    setPageActive(state ? state.active : null)
    setBusy(false)
  }

  const toggleAlwaysTranslate = async (checked: boolean) => {
    if (!hostname) return
    setAutoHosts(
      checked ? [...new Set([...autoHosts, hostname])] : autoHosts.filter((h) => h !== hostname),
    )
    if (checked && !pageActive) {
      const state = await sendTabRequest({ type: 'set-page-translation', enabled: true })
      setPageActive(state ? state.active : null)
    }
  }

  return (
    <section className='flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white/80 p-3'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium text-slate-800'>网页翻译</span>
        <button
          type='button'
          onClick={openOptionsPage}
          className='text-xs text-slate-400 transition-colors hover:text-indigo-600'
        >
          更多设置 ↗
        </button>
      </div>

      <div className='grid grid-cols-2 gap-2'>
        <label className='flex flex-col gap-1'>
          <span className='text-[11px] text-slate-400'>翻译引擎</span>
          <Select
            value={provider}
            options={PROVIDER_OPTIONS}
            onChange={(value) => setProvider(value as TranslateProvider)}
          />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-[11px] text-slate-400'>目标语言</span>
          <Select
            value={target}
            options={TARGET_LANGUAGE_OPTIONS}
            onChange={(value) => setTarget(value as TranslateTargetSetting)}
          />
        </label>
      </div>

      {provider === 'llm' && <LlmPanel needsSetup={llmMissing} />}

      <div className='flex items-center justify-between gap-2'>
        <span className='text-xs text-slate-500'>展示方式</span>
        <Tabs
          value={displayMode}
          tabs={DISPLAY_MODE_OPTIONS}
          onChange={(value) => setDisplayMode(value as TranslateDisplayMode)}
        />
      </div>

      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-col'>
          <span className='text-xs text-slate-500'>译文下划线</span>
          <span className='truncate text-[11px] text-slate-400'>用虚线标出译文，方便区分原文</span>
        </div>
        <Switch checked={underline} onChange={setUnderline} />
      </div>

      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-col'>
          <span className='text-xs text-slate-500'>悬停翻译</span>
          <span className='truncate text-[11px] text-slate-400'>
            {describeHoverMode(hoverMode)}
          </span>
        </div>
        <Select
          value={hoverMode}
          options={HOVER_MODE_OPTIONS}
          placement='top'
          onChange={(value) => setHoverMode(value as HoverTranslateMode)}
          className='w-[132px] shrink-0'
        />
      </div>

      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-col'>
          <span className='text-xs text-slate-500'>总是翻译该网站</span>
          <span className='truncate text-[11px] text-slate-400'>
            {hostname || '当前页面不支持'}
          </span>
        </div>
        <Switch
          checked={alwaysTranslate}
          disabled={!hostname}
          onChange={(checked) => void toggleAlwaysTranslate(checked)}
        />
      </div>

      <Button
        variant='primary'
        block
        loading={busy}
        disabled={unsupported || llmMissing}
        onClick={() => void togglePage()}
      >
        {pageActive ? '显示原文' : '翻译当前页面'}
      </Button>
      <p className='text-left text-[11px] leading-snug text-slate-400'>
        {unsupported
          ? '当前页面不支持翻译（浏览器内置页 / 扩展商店），普通网页请刷新后重试'
          : '译文随滚动按需加载 · 也可通过右键菜单或快捷键切换'}
      </p>
    </section>
  )
}
