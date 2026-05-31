import { useEffect, useRef, useState } from 'react'

import CopyIcon from '@/assets/copy.svg'
import { lookupWord } from '@/api/lookup'
import { sendTabMessage } from '@/utils/messaging'
import {
  lookupProvider,
  translateProvider,
  type LookupProvider,
  type TranslateProvider,
} from '@/utils/settings'
import type { WordResult } from '@/types/word'
import Button from '@/ui/Button'
import Select from '@/ui/Select'

export default function TranslatePage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<WordResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [lookupEngine, setLookupEngine] = useState<LookupProvider>('youdao')
  const [provider, setProvider] = useState<TranslateProvider>('microsoft')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    lookupProvider.getValue().then(setLookupEngine)
    translateProvider.getValue().then(setProvider)
    inputRef.current?.focus()
  }, [])

  const changeLookupEngine = (value: string) => {
    const v = value as LookupProvider
    setLookupEngine(v)
    lookupProvider.setValue(v)
  }

  const changeProvider = (value: string) => {
    const v = value as TranslateProvider
    setProvider(v)
    translateProvider.setValue(v)
  }

  // 查词
  const translate = async () => {
    if (!text.trim()) return
    setLoading(true)
    const res = await lookupWord(text.trim(), lookupEngine)
    setResult(res)
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
    <div className='flex flex-col gap-4'>
      {/* ── 查词：下拉 + 输入 + 按钮 一行 ── */}
      <section className='flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <Select
            value={lookupEngine}
            onChange={changeLookupEngine}
            className='w-[72px] shrink-0'
            options={[
              { value: 'youdao', label: '有道' },
              { value: 'microsoft', label: '微软' },
              { value: 'google', label: '谷歌' },
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

      {/* 分隔 */}
      <div className='h-px bg-slate-200' />

      {/* ── 整页翻译：下拉 + 按钮 一行 ── */}
      <section className='flex flex-col gap-1.5'>
        <div className='flex items-center gap-2'>
          <Select
            value={provider}
            onChange={changeProvider}
            className='w-[152px] shrink-0'
            options={[
              { value: 'microsoft', label: '微软 · 免翻墙' },
              { value: 'google', label: 'Google · 需翻墙' },
            ]}
          />
          <Button
            variant='primary'
            block
            onClick={() => sendTabMessage({ type: 'translate-page' })}
          >
            翻译当前页面
          </Button>
        </div>
        <p className='text-center text-xs text-slate-400'>原文下方插入译文 · 再次点击可移除</p>
      </section>
    </div>
  )
}
