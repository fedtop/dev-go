import { useEffect, useRef, useState } from 'react'

import CopyIcon from '@/assets/copy.svg'
import { lookupWord } from '@/api/lookup'
import PageTranslatePanel from '@/features/popup/PageTranslatePanel'
import { isLlmUsable } from '@/features/translate/llm-config'
import { sendRuntimeMessage } from '@/utils/messaging'
import {
  lookupProvider,
  translateLlmApiKey,
  translateLlmConfig,
  type LookupProvider,
} from '@/utils/settings'
import { useStorageItem } from '@/utils/useStorageItem'
import type { WordResult } from '@/types/word'
import Button from '@/ui/Button'
import Select from '@/ui/Select'

export default function TranslatePage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<WordResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [lookupEngine, setLookupEngine] = useState<LookupProvider>('youdao')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [llmConfig] = useStorageItem(translateLlmConfig)
  const [llmApiKey] = useStorageItem(translateLlmApiKey)
  // 配置了翻译模型才提供 AI 查词；之前选了 AI、后来删掉配置时回落到有道
  const aiAvailable = isLlmUsable(llmConfig, llmApiKey)
  const engine: LookupProvider = lookupEngine === 'ai' && !aiAvailable ? 'youdao' : lookupEngine

  useEffect(() => {
    lookupProvider.getValue().then(setLookupEngine)
    inputRef.current?.focus()
  }, [])

  const changeLookupEngine = (value: string) => {
    const v = value as LookupProvider
    setLookupEngine(v)
    lookupProvider.setValue(v)
  }

  // 查词
  const translate = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    if (engine === 'ai') {
      const res = await sendRuntimeMessage({ type: 'ai-lookup', text: text.trim() }).catch(
        (err: unknown) => ({
          result: null,
          error: { code: 'unknown' as const, message: String(err) },
        }),
      )
      setResult(res.result)
      if (res.error) setError(`AI 查询失败：${res.error.message}`)
    } else {
      setResult(await lookupWord(text.trim(), engine))
    }
    setLoading(false)
  }

  // 朗读
  const readText = (url?: string) => {
    if (url) {
      new Audio(url).play()
      return
    }
    const msg = new SpeechSynthesisUtterance()
    msg.text = result?.query || result?.translation || 'hello'
    msg.lang = /[\u4e00-\u9fa5]/.test(msg.text) ? 'zh-CN' : 'en-US'
    msg.rate = 0.9
    speechSynthesis.speak(msg)
  }

  return (
    <div className='flex flex-col gap-3 pb-1'>
      {/* ── 查词：下拉 + 输入 + 按钮 一行 ── */}
      <section className='flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <Select
            value={engine}
            onChange={changeLookupEngine}
            className='w-[72px] shrink-0'
            options={[
              { value: 'youdao', label: '有道' },
              { value: 'microsoft', label: '微软' },
              { value: 'google', label: '谷歌' },
              ...(aiAvailable ? [{ value: 'ai', label: 'AI' }] : []),
            ]}
          />
          <input
            ref={inputRef}
            placeholder='输入单词或短句'
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && translate()}
            className='min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
          />
          <Button variant='primary' onClick={translate} loading={loading} className='shrink-0'>
            查询
          </Button>
        </div>

        {error && (
          <p className='rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700'>{error}</p>
        )}

        {/* 查词结果卡片 */}
        {result && (
          <div className='relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm'>
            <button
              type='button'
              title='复制译文'
              onClick={() => navigator.clipboard.writeText(result.translation)}
              className='absolute right-2.5 top-2.5 opacity-40 transition-opacity hover:opacity-80'
            >
              <img src={CopyIcon} alt='复制' className='w-4' />
            </button>

            {/* 词 + 音标 + 朗读 */}
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1 pr-6'>
              <span className='text-[15px] font-semibold text-slate-800'>{result.query}</span>
              {result.phonetic && (
                <span className='font-mono text-xs text-slate-400'>/{result.phonetic}/</span>
              )}
              <button
                type='button'
                title='朗读'
                onClick={() => readText(result.speakUrl)}
                className='text-slate-400 transition-colors hover:text-blue-600'
              >
                🔊
              </button>
            </div>

            {/* 译文 */}
            {result.translation && (
              <p className='mt-1.5 text-sm text-slate-600'>{result.translation}</p>
            )}

            {/* 释义（按词性） */}
            {result.entries.length > 0 && (
              <div className='mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2'>
                {result.entries.map((entry) => (
                  <div key={entry.pos || 'misc'} className='flex gap-2 text-[13px] leading-relaxed'>
                    {entry.pos && (
                      <span className='shrink-0 font-mono text-xs text-blue-500'>{entry.pos}.</span>
                    )}
                    <span className='text-slate-600'>{entry.terms.join('；')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 网页翻译 ── */}
      <PageTranslatePanel />
    </div>
  )
}
