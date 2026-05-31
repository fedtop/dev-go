import { useCallback, useEffect, useRef, useState } from 'react'

import CopyIcon from '@/assets/copy.svg'
import { sendRuntimeMessage } from '@/utils/messaging'
import type { DictResult } from '@/types/dict'

interface Pos {
  x: number
  y: number
}

type BubbleStatus = 'loading' | 'done' | 'error'

const MAX_SELECTION_LEN = 5000

/** 判断选中文本是否为单个英文单词 / 短词（用于决定是否查词典） */
function isSingleWord(text: string): boolean {
  return /^[a-zA-Z][a-zA-Z'-]*$/.test(text)
}

/** 用浏览器 TTS 朗读文本 */
function speak(text: string, lang: string) {
  try {
    speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    utter.rate = 0.9
    speechSynthesis.speak(utter)
  } catch {
    /* 部分环境不支持，忽略 */
  }
}

/** 判断节点是否处于可编辑元素中（输入框不触发划词翻译） */
function isEditableTarget(node: Node | null): boolean {
  let el = node instanceof Element ? node : node?.parentElement
  while (el) {
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable) {
      return true
    }
    el = el.parentElement
  }
  return false
}

interface BubbleState {
  pos: Pos
  status: BubbleStatus
  text: string
  /** 原文（朗读用） */
  source: string
  /** 单词词典结果（仅单词时有） */
  dict: DictResult | null
}

export default function SelectionApp() {
  // 翻译触发按钮位置（null 表示隐藏）
  const [trigger, setTrigger] = useState<Pos | null>(null)
  // 译文气泡
  const [bubble, setBubble] = useState<BubbleState | null>(null)
  const selectedTextRef = useRef('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  // 事件是否发生在本扩展 UI 内部（避免点击自身按钮时清空选区）
  const isInsideUi = useCallback((e: Event) => {
    const path = e.composedPath()
    return wrapperRef.current ? path.includes(wrapperRef.current) : false
  }, [])

  const close = useCallback(() => {
    setTrigger(null)
    setBubble(null)
  }, [])

  // 选区变化 -> 显示 / 隐藏触发按钮
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      // 点击自身 UI 不重新计算
      if (isInsideUi(e)) return

      // 延迟读取，等选区状态稳定
      setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim() ?? ''

        if (
          !selection ||
          selection.isCollapsed ||
          !text ||
          text.length > MAX_SELECTION_LEN ||
          isEditableTarget(selection.anchorNode)
        ) {
          setTrigger(null)
          return
        }

        const rect = selection.getRangeAt(0).getBoundingClientRect()
        if (!rect.width && !rect.height) return

        selectedTextRef.current = text
        setBubble(null)
        // 按钮放在选区右下角
        setTrigger({ x: rect.right, y: rect.bottom })
      }, 10)
    }

    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [isInsideUi])

  // 点击外部 / ESC / 滚动 -> 关闭
  useEffect(() => {
    if (!trigger && !bubble) return undefined

    const onMouseDown = (e: MouseEvent) => {
      if (!isInsideUi(e)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onScroll = () => close()

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [trigger, bubble, close, isInsideUi])

  // 点击触发按钮 -> 翻译并展示气泡
  const handleTranslate = async () => {
    const text = selectedTextRef.current
    const pos = trigger
    if (!text || !pos) return

    setTrigger(null)
    setBubble({ pos, status: 'loading', text: '', source: text, dict: null })

    const word = isSingleWord(text)
    // 单词时并行查词典
    const [transRes, dict] = await Promise.all([
      sendRuntimeMessage({ type: 'translate', text }),
      word ? sendRuntimeMessage({ type: 'lookup', word: text }) : Promise.resolve(null),
    ])

    setBubble({
      pos,
      status: transRes?.text ? 'done' : 'error',
      text: transRes?.text || '翻译失败，请检查网络或切换翻译引擎',
      source: text,
      dict,
    })
  }

  return (
    <div ref={wrapperRef}>
      {trigger && (
        <button
          type='button'
          onClick={handleTranslate}
          title='翻译选中文本'
          style={{
            position: 'fixed',
            left: Math.min(trigger.x + 4, window.innerWidth - 36),
            top: Math.min(trigger.y + 4, window.innerHeight - 36),
            zIndex: 2147483647,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            border: 'none',
            borderRadius: '50%',
            background: '#347d39',
            color: '#fff',
            fontSize: 15,
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          译
        </button>
      )}

      {bubble && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(bubble.pos.x, window.innerWidth - 340),
            top: Math.min(bubble.pos.y + 8, window.innerHeight - 80),
            zIndex: 2147483647,
            maxWidth: 320,
            minWidth: 160,
            padding: '10px 12px',
            background: '#1f2937',
            color: '#f3f4f6',
            fontSize: 14,
            lineHeight: 1.5,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            wordBreak: 'break-word',
          }}
        >
          {bubble.status === 'loading' && <span style={{ opacity: 0.8 }}>翻译中…</span>}
          {bubble.status !== 'loading' && (
            <div>
              {/* 原文 + 朗读（单词时显示） */}
              {bubble.status === 'done' && bubble.dict && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                    paddingBottom: 6,
                    borderBottom: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{bubble.dict.word}</span>
                  <span
                    title='朗读'
                    onClick={() => speak(bubble.source, 'en-US')}
                    style={{ cursor: 'pointer', fontSize: 13, opacity: 0.85 }}
                  >
                    🔊
                  </span>
                </div>
              )}

              {/* 译文 + 复制 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flex: 1, color: bubble.status === 'error' ? '#fca5a5' : undefined }}>
                  {bubble.text}
                </span>
                {bubble.status === 'done' && (
                  <img
                    src={CopyIcon}
                    alt='复制'
                    title='复制译文'
                    onClick={() => navigator.clipboard.writeText(bubble.text)}
                    style={{
                      width: 16,
                      flexShrink: 0,
                      cursor: 'pointer',
                      filter: 'invert(1)',
                      opacity: 0.7,
                    }}
                  />
                )}
              </div>

              {/* 词典释义（按词性分组） */}
              {bubble.status === 'done' && bubble.dict && bubble.dict.entries.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                  {bubble.dict.entries.map((entry) => (
                    <div key={entry.pos || 'misc'} style={{ display: 'flex', gap: 6 }}>
                      {entry.pos && (
                        <span style={{ flexShrink: 0, fontStyle: 'italic', opacity: 0.6 }}>
                          {entry.pos}.
                        </span>
                      )}
                      <span style={{ opacity: 0.9 }}>{entry.terms.join('；')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
