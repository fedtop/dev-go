import { useEffect, useState } from 'react'

import { isLlmUsable } from '@/features/translate/llm-config'
import { TARGET_LANGUAGE_OPTIONS } from '@/features/translate/languages'
import { PROVIDER_OPTIONS } from '@/features/translate/ui-options'
import { sendTabRequest } from '@/utils/messaging'
import {
  translateAutoHosts,
  translateLlmApiKey,
  translateLlmConfig,
  translateProvider,
  translateTargetLang,
  type TranslateProvider,
} from '@/utils/settings'
import type { TranslateTargetSetting } from '@/features/translate/languages'
import { useStorageItem } from '@/utils/useStorageItem'
import Button from '@/ui/Button'
import Select from '@/ui/Select'
import Switch from '@/ui/Switch'
import { formatShortcut } from '@/utils/shortcut'
import { getActiveHostname } from '@/utils/tabs'

/** 打开设置页的指定分区（如 #translate、#models），并关闭 popup */
function openOptionsSection(section: string) {
  void browser.tabs
    .create({ url: browser.runtime.getURL(`/options.html#${section}`) })
    .finally(() => window.close())
}

/** popup「翻译」页的整页翻译面板 */
export default function PageTranslatePanel() {
  const [provider, setProvider] = useStorageItem(translateProvider)
  const [target, setTarget] = useStorageItem(translateTargetLang)
  const [autoHosts, setAutoHosts] = useStorageItem(translateAutoHosts)
  const [llmConfig] = useStorageItem(translateLlmConfig)
  const [llmApiKey] = useStorageItem(translateLlmApiKey)

  const [hostname, setHostname] = useState('')
  /** null：当前页面无法注入内容脚本（浏览器内置页、扩展商店等） */
  const [pageActive, setPageActive] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  /** 整页翻译命令当前绑定的快捷键（chrome://extensions/shortcuts 里设置；默认不带键） */
  const [shortcut, setShortcut] = useState('')

  useEffect(() => {
    void browser.commands
      ?.getAll()
      .then((commands) =>
        setShortcut(
          commands.find((command) => command.name === 'inline-translate')?.shortcut ?? '',
        ),
      )
  }, [])

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
          onClick={() => openOptionsSection('translate')}
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

      {provider === 'llm' && (
        <button
          type='button'
          onClick={() => openOptionsSection('models')}
          className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
            llmMissing
              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'bg-indigo-50/60 text-slate-500 hover:bg-indigo-50'
          }`}
        >
          <span className='truncate'>
            {llmMissing ? '还没有配置翻译模型，AI 翻译暂不可用' : `翻译模型：${llmConfig.model}`}
          </span>
          <span className='shrink-0 text-indigo-600'>{llmMissing ? '去配置 ↗' : '修改 ↗'}</span>
        </button>
      )}

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
        {shortcut && (
          <kbd className='ml-1.5 font-sans text-xs opacity-75'>{formatShortcut(shortcut)}</kbd>
        )}
      </Button>
      <p className='text-left text-[11px] leading-snug text-slate-400'>
        {unsupported
          ? '当前页面不支持翻译（浏览器内置页 / 扩展商店），普通网页请刷新后重试'
          : shortcut
            ? `译文随滚动按需加载 · 也可通过右键菜单或 ${formatShortcut(shortcut)} 切换`
            : '译文随滚动按需加载 · 也可通过右键菜单切换；快捷键可在设置页「通用」里设置'}
      </p>
    </section>
  )
}
