import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import {
  isWriteAction,
  READ_ACTIONS,
  SELECTION_AI_ACTIONS,
  WRITE_ACTIONS,
  type SelectionAiAction,
} from '@/features/ai/actions'
import { isChatModelReady } from '@/features/ai/model'
import type { DictResult } from '@/types/dict'
import Markdown from '@/ui/Markdown'
import { sendRuntimeMessage, type OpenAssistantMessage } from '@/utils/messaging'
import {
  assistantLlmApiKey,
  assistantLlmConfig,
  selectionAiEnabled,
  translateLlmApiKey,
  translateLlmConfig,
} from '@/utils/settings'

import { readSelection, replaceSelection, type Rect, type SelectionSnapshot } from './selection-dom'
import { useSelectionAi } from './useSelectionAi'

const MAX_SELECTION_LEN = 5000
const BUBBLE_WIDTH = 380
const VIEWPORT_MARGIN = 10
/** 选区下方空间不足这个高度时，气泡改放到选区上方 */
const MIN_SPACE_BELOW = 220
const Z_TOP = 2147483647

type Mode = 'translate' | SelectionAiAction

interface TranslateState {
  status: 'loading' | 'done' | 'error'
  text: string
  dict: DictResult | null
}

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

/** AI 动作是否可用：开关开启，且对话模型（或沿用的翻译模型）已配置 */
function useAiAvailable(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = () => {
      Promise.all([selectionAiEnabled.getValue(), isChatModelReady()])
        .then(([enabled, ready]) => active && setAvailable(enabled && ready))
        .catch(() => active && setAvailable(false))
    }
    refresh()
    const unwatchers = [
      selectionAiEnabled,
      assistantLlmConfig,
      assistantLlmApiKey,
      translateLlmConfig,
      translateLlmApiKey,
    ].map((item) => item.watch(refresh))
    return () => {
      active = false
      unwatchers.forEach((unwatch) => unwatch())
    }
  }, [])

  return available
}

/** 气泡位置：默认在选区下方，下方空间不足时放到上方；水平方向不超出视口 */
function bubbleStyle(rect: Rect): CSSProperties {
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.left, window.innerWidth - BUBBLE_WIDTH - VIEWPORT_MARGIN),
  )
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN
  if (spaceBelow >= MIN_SPACE_BELOW || spaceBelow >= rect.top) {
    return { left, top: rect.bottom + 8, maxHeight: Math.max(160, spaceBelow - 8) }
  }
  return {
    left,
    bottom: window.innerHeight - rect.top + 8,
    maxHeight: Math.max(160, rect.top - VIEWPORT_MARGIN - 8),
  }
}

function toolbarStyle(rect: Rect): CSSProperties {
  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(rect.right + 4, window.innerWidth - 260)),
    top: Math.min(rect.bottom + 6, window.innerHeight - 40),
  }
}

/** 划词工具条与结果气泡：翻译（引擎同翻译设置）+ AI 解释 / 总结 / 问 AI + 输入框内的润色改写 */
export default function SelectionApp() {
  const aiAvailable = useAiAvailable()
  const [toolbar, setToolbar] = useState<SelectionSnapshot | null>(null)
  const [bubble, setBubble] = useState<{ snapshot: SelectionSnapshot; mode: Mode } | null>(null)
  const [translation, setTranslation] = useState<TranslateState | null>(null)
  const { result: aiResult, run: runAi, reset: resetAi } = useSelectionAi()
  const [copied, setCopied] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const translateSeqRef = useRef(0)

  // 事件是否发生在本扩展 UI 内部（避免点击自身按钮时清空选区）
  const isInsideUi = useCallback((e: Event) => {
    const path = e.composedPath()
    return wrapperRef.current ? path.includes(wrapperRef.current) : false
  }, [])

  const close = useCallback(() => {
    translateSeqRef.current += 1
    setToolbar(null)
    setBubble(null)
    setTranslation(null)
    resetAi()
  }, [resetAi])

  // 选区变化 -> 显示 / 隐藏工具条
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (isInsideUi(e)) return
      const pointer = { x: e.clientX, y: e.clientY }
      // 延迟读取，等选区状态稳定
      window.setTimeout(() => {
        const snapshot = readSelection(pointer)
        if (!snapshot || snapshot.text.trim().length > MAX_SELECTION_LEN) {
          setToolbar(null)
          return
        }
        // 输入框内只提供 AI 改写；AI 不可用时不打扰输入
        if (snapshot.editable && !aiAvailable) {
          setToolbar(null)
          return
        }
        setToolbar(snapshot)
      }, 10)
    }

    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [isInsideUi, aiAvailable])

  // 点击外部 / ESC -> 关闭；页面滚动只收起工具条（气泡里的结果可能还在阅读）
  useEffect(() => {
    if (!toolbar && !bubble) return undefined

    const onMouseDown = (e: MouseEvent) => {
      if (!isInsideUi(e)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onScroll = (e: Event) => {
      if (!isInsideUi(e)) setToolbar(null)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [toolbar, bubble, close, isInsideUi])

  const translate = async (snapshot: SelectionSnapshot) => {
    const text = snapshot.text.trim()
    const seq = (translateSeqRef.current += 1)
    setTranslation({ status: 'loading', text: '', dict: null })

    const [result, dict] = await Promise.all([
      sendRuntimeMessage({ type: 'translate', text }).catch(() => null),
      isSingleWord(text)
        ? sendRuntimeMessage({ type: 'lookup', word: text }).catch(() => null)
        : Promise.resolve(null),
    ])
    if (seq !== translateSeqRef.current) return

    setTranslation({
      status: result?.text ? 'done' : 'error',
      text:
        result?.text ||
        (result?.error
          ? `翻译失败：${result.error.message}`
          : '翻译失败，请检查网络或切换翻译引擎'),
      dict,
    })
  }

  const start = (snapshot: SelectionSnapshot, mode: Mode) => {
    setToolbar(null)
    setCopied(false)
    setBubble({ snapshot, mode })
    if (mode === 'translate') {
      resetAi()
      void translate(snapshot)
    } else {
      translateSeqRef.current += 1
      setTranslation(null)
      runAi(mode, snapshot.text.trim(), {
        paragraph: snapshot.paragraph || undefined,
        title: document.title,
        url: location.href,
      })
    }
  }

  /** 交给侧边栏助手：带上选中文字，以及气泡里已有的一轮问答 */
  const askInSidePanel = (
    snapshot: SelectionSnapshot,
    exchange?: { question: string; answer: string },
  ) => {
    const message: OpenAssistantMessage = {
      type: 'open-assistant',
      handoff: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        quote: snapshot.text.trim(),
        url: location.href,
        title: document.title,
        exchange,
      },
    }
    // 必须在点击的同步调用栈里发出：后台据此在用户手势内打开侧边栏
    browser.runtime.sendMessage(message).catch(() => undefined)
    close()
  }

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => setCopied(true))
  }

  const replace = (snapshot: SelectionSnapshot, text: string) => {
    if (snapshot.editable && replaceSelection(snapshot.editable, text)) close()
  }

  return (
    <div ref={wrapperRef} className='text-sm leading-relaxed'>
      {toolbar && (
        <Toolbar
          snapshot={toolbar}
          aiAvailable={aiAvailable}
          onAction={(mode) => start(toolbar, mode)}
          onAsk={() => askInSidePanel(toolbar)}
        />
      )}

      {bubble && (
        <div
          className='fixed flex flex-col overflow-hidden rounded-xl bg-[#1f2937] text-[#f3f4f6] shadow-[0_8px_28px_rgba(0,0,0,0.35)]'
          style={{ ...bubbleStyle(bubble.snapshot.rect), zIndex: Z_TOP, width: BUBBLE_WIDTH }}
        >
          {aiAvailable && (
            <ModeTabs
              modes={bubble.snapshot.editable ? WRITE_ACTIONS : ['translate', ...READ_ACTIONS]}
              current={bubble.mode}
              onSelect={(mode) => start(bubble.snapshot, mode)}
            />
          )}

          <div className='min-h-0 flex-1 overflow-y-auto px-3 py-2.5'>
            {bubble.mode === 'translate' ? (
              <TranslateView state={translation} source={bubble.snapshot.text.trim()} />
            ) : (
              <AiView result={aiResult} />
            )}
          </div>

          <BubbleFooter>
            {bubble.mode === 'translate' && translation?.status === 'done' && (
              <FooterButton onClick={() => copy(translation.text)}>
                {copied ? '已复制' : '复制'}
              </FooterButton>
            )}
            {bubble.mode !== 'translate' && aiResult?.status === 'done' && (
              <>
                {isWriteAction(bubble.mode) && bubble.snapshot.editable && (
                  <FooterButton primary onClick={() => replace(bubble.snapshot, aiResult.text)}>
                    替换原文
                  </FooterButton>
                )}
                <FooterButton onClick={() => copy(aiResult.text)}>
                  {copied ? '已复制' : '复制'}
                </FooterButton>
                {!isWriteAction(bubble.mode) && (
                  <FooterButton
                    onClick={() =>
                      askInSidePanel(bubble.snapshot, {
                        question: `${SELECTION_AI_ACTIONS[bubble.mode as SelectionAiAction].label}这段内容`,
                        answer: aiResult.text,
                      })
                    }
                  >
                    继续追问
                  </FooterButton>
                )}
              </>
            )}
            {bubble.mode !== 'translate' && aiResult?.status === 'error' && (
              <FooterButton onClick={() => start(bubble.snapshot, bubble.mode)}>重试</FooterButton>
            )}
          </BubbleFooter>
        </div>
      )}
    </div>
  )
}

function Toolbar({
  snapshot,
  aiAvailable,
  onAction,
  onAsk,
}: {
  snapshot: SelectionSnapshot
  aiAvailable: boolean
  onAction: (mode: Mode) => void
  onAsk: () => void
}) {
  const button =
    'h-7 cursor-pointer rounded-md border-0 bg-transparent px-2 text-[13px] text-white transition-colors hover:bg-white/15'

  // 只有翻译按钮时保持原来的圆形「译」按钮，不增加视觉负担
  if (!aiAvailable) {
    return (
      <button
        type='button'
        title='翻译选中文本'
        onClick={() => onAction('translate')}
        className='fixed flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-[#347d39] p-0 text-[15px] leading-none text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
        style={{ ...toolbarStyle(snapshot.rect), zIndex: Z_TOP }}
      >
        译
      </button>
    )
  }

  const modes: Mode[] = snapshot.editable ? WRITE_ACTIONS : ['translate', ...READ_ACTIONS]
  return (
    <div
      // 阻止 mousedown 的默认行为：点击工具条不让输入框失焦、不清掉选区
      onMouseDown={(event) => event.preventDefault()}
      className='fixed flex items-center gap-0.5 rounded-lg bg-[#1f2937] p-0.5 shadow-[0_4px_14px_rgba(0,0,0,0.3)]'
      style={{ ...toolbarStyle(snapshot.rect), zIndex: Z_TOP }}
    >
      {modes.map((mode) => (
        <button
          key={mode}
          type='button'
          title={mode === 'translate' ? '翻译选中文本' : SELECTION_AI_ACTIONS[mode].title}
          onClick={() => onAction(mode)}
          className={button}
        >
          {mode === 'translate' ? '翻译' : SELECTION_AI_ACTIONS[mode].label}
        </button>
      ))}
      {!snapshot.editable && (
        <button
          type='button'
          title='在侧边栏里就选中内容提问'
          onClick={onAsk}
          className={`${button} text-[#a5b4fc]`}
        >
          问 AI
        </button>
      )}
    </div>
  )
}

function ModeTabs({
  modes,
  current,
  onSelect,
}: {
  modes: Mode[]
  current: Mode
  onSelect: (mode: Mode) => void
}) {
  return (
    <div className='flex shrink-0 gap-1 border-b border-white/10 px-2 pt-2 pb-1.5'>
      {modes.map((mode) => (
        <button
          key={mode}
          type='button'
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => mode !== current && onSelect(mode)}
          className={`cursor-pointer rounded-md border-0 px-2 py-0.5 text-xs transition-colors ${
            mode === current
              ? 'bg-white/15 text-white'
              : 'bg-transparent text-white/55 hover:text-white'
          }`}
        >
          {mode === 'translate' ? '翻译' : SELECTION_AI_ACTIONS[mode].label}
        </button>
      ))}
    </div>
  )
}

function TranslateView({ state, source }: { state: TranslateState | null; source: string }) {
  if (!state || state.status === 'loading') return <p className='opacity-80'>翻译中…</p>

  return (
    <div className='flex flex-col gap-1.5'>
      {state.status === 'done' && state.dict && (
        <div className='flex items-center gap-1.5 border-b border-white/10 pb-1.5'>
          <span className='font-semibold'>{state.dict.word}</span>
          <button
            type='button'
            title='朗读'
            onClick={() => speak(source, 'en-US')}
            className='cursor-pointer border-0 bg-transparent p-0 text-[13px] opacity-85'
          >
            🔊
          </button>
        </div>
      )}
      <p className={state.status === 'error' ? 'text-[#fca5a5]' : ''}>{state.text}</p>
      {state.status === 'done' && state.dict && state.dict.entries.length > 0 && (
        <div className='text-[13px] leading-relaxed'>
          {state.dict.entries.map((entry) => (
            <div key={entry.pos || 'misc'} className='flex gap-1.5'>
              {entry.pos && <span className='shrink-0 italic opacity-60'>{entry.pos}.</span>}
              <span className='opacity-90'>{entry.terms.join('；')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AiView({ result }: { result: ReturnType<typeof useSelectionAi>['result'] }) {
  if (!result) return null
  if (result.status === 'error') return <p className='text-[#fca5a5]'>{result.error}</p>
  if (result.status === 'loading') {
    return (
      <div className='flex flex-col gap-1'>
        <p className='animate-pulse opacity-80'>{result.reasoning ? '思考中…' : '生成中…'}</p>
        {result.reasoning && (
          <p className='line-clamp-3 text-xs opacity-45'>{result.reasoning.slice(-240)}</p>
        )}
      </div>
    )
  }
  return <Markdown text={result.text} className='text-[13.5px]' />
}

function BubbleFooter({ children }: { children: ReactNode }) {
  return (
    <div className='flex shrink-0 justify-end gap-1.5 px-3 pb-2.5 empty:hidden'>{children}</div>
  )
}

function FooterButton({
  primary = false,
  onClick,
  children,
}: {
  primary?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type='button'
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`cursor-pointer rounded-md border-0 px-2.5 py-1 text-xs transition-colors ${
        primary
          ? 'bg-indigo-500 text-white hover:bg-indigo-400'
          : 'bg-white/10 text-white/85 hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  )
}
