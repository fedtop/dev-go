import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import type { AgentMessage } from '@/api/llm'
import { resolveChatModel } from '@/features/ai/model'
import { describeServiceError, toTranslateError } from '@/features/translate/errors'
import { isLlmConfigReady } from '@/features/translate/llm-config'
import LlmConfigForm from '@/features/translate/LlmConfigForm'
import Button from '@/ui/Button'
import Markdown from '@/ui/Markdown'
import Switch from '@/ui/Switch'
import { sendRuntimeMessage, type AssistantHandoff } from '@/utils/messaging'
import {
  assistantConfirmTools,
  assistantHandoff,
  assistantLlmApiKey,
  assistantLlmConfig,
  translateLlmApiKey,
  translateLlmConfig,
} from '@/utils/settings'
import { useStorageItem } from '@/utils/useStorageItem'

import { buildSystemPrompt, repairHistory, runAgent, type AgentEvent } from './agent'
import { formatPageContent, isBuiltinTool, readPage, READ_PAGE_TOOL } from './page-tools'
import ToolsPanel from './ToolsPanel'
import { executeFrameTool, useActiveTabId, useWebmcpTools, type FrameTool } from './webmcp-client'
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  FileText,
  Globe,
  Languages,
  ListChecks,
  Settings,
  Sparkles,
  Square,
  SquarePen,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import IconButton from '@/ui/IconButton'

type ToolStatus = 'running' | 'awaiting' | 'done' | 'error' | 'rejected'

type ChatItem =
  | { kind: 'user'; id: string; text: string; quote?: string; withPage?: boolean }
  | { kind: 'assistant'; id: string; text: string; reasoning: string; done: boolean }
  | {
      kind: 'tool'
      id: string
      name: string
      args: string
      status: ToolStatus
      result?: string
    }
  | { kind: 'error'; id: string; text: string }

/** 发给模型的一条用户输入 */
interface Prompt {
  /** 界面上展示的文字 */
  text: string
  /** 引用的选中内容 */
  quote?: string
  /** 附带当前网页正文（快捷指令） */
  withPage?: boolean
}

const QUICK_ACTIONS: Array<{ label: string; prompt: string; icon: LucideIcon }> = [
  {
    label: '总结本页',
    icon: FileText,
    prompt: '总结这个网页的主要内容：先用一两句话概括，再分点列出关键信息。',
  },
  {
    label: '提取要点',
    icon: ListChecks,
    prompt:
      '提取这个网页里的关键信息（结论、数据、步骤、注意事项等），用列表列出，不要遗漏重要细节。',
  },
  {
    label: '用中文讲讲',
    icon: Languages,
    prompt: '用简体中文介绍这个网页讲了什么、适合谁看，以及最值得关注的部分。',
  },
]

const TOOL_STATUS_LABELS: Record<ToolStatus, string> = {
  running: '执行中',
  awaiting: '待确认',
  done: '完成',
  error: '失败',
  rejected: '已拒绝',
}

let idSeed = 0
const nextId = () => `item-${(idSeed += 1)}`

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function quoteBlock(quote: string): string {
  return `"""\n${quote}\n"""`
}

/** 侧边栏 AI 助手：读取网页内容回答问题、总结网页，并可调用网页通过 WebMCP 提供的工具 */
export default function AssistantApp() {
  const tabId = useActiveTabId()
  const { tools: webTools, status, page, refresh } = useWebmcpTools(tabId)

  const [assistantConfig, , assistantLoaded] = useStorageItem(assistantLlmConfig)
  const [assistantKey] = useStorageItem(assistantLlmApiKey)
  const [translateConfig, , translateLoaded] = useStorageItem(translateLlmConfig)
  const [translateKey] = useStorageItem(translateLlmApiKey)
  const [confirmTools, setConfirmTools] = useStorageItem(assistantConfirmTools)

  const { config, apiKey, inherited } = resolveChatModel(
    assistantConfig,
    assistantKey,
    translateConfig,
    translateKey,
  )
  const configReady = isLlmConfigReady(config)
  const loaded = assistantLoaded && translateLoaded

  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [quote, setQuote] = useState('')
  const [running, setRunning] = useState(false)

  const historyRef = useRef<AgentMessage[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const confirmsRef = useRef(new Map<string, (allowed: boolean) => void>())
  /** 模型给的调用 id 不保证全局唯一（未返回 id 时每步都是 call_0），界面另行分配 id */
  const toolItemIdsRef = useRef(new Map<string, string>())
  const toolsRef = useRef<FrameTool[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottomRef = useRef(true)

  // 内置工具在前：网页工具同名时由 bindTools 追加序号区分
  toolsRef.current = [READ_PAGE_TOOL, ...webTools]

  // 只在首次加载完成时判断一次：未配置就先进设置页，之后不再自动切换视图
  const viewDecidedRef = useRef(false)
  useEffect(() => {
    if (!loaded || viewDecidedRef.current) return
    viewDecidedRef.current = true
    if (!configReady) setView('settings')
  }, [loaded, configReady])

  // 新内容到达时保持滚动到底部（用户主动上翻时不打扰）
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [items])

  const updateTool = (id: string, patch: Partial<Extract<ChatItem, { kind: 'tool' }>>) => {
    setItems((current) =>
      current.map((item) =>
        item.kind === 'tool' && item.id === id ? { ...item, ...patch } : item,
      ),
    )
  }

  const handleEvent = (event: AgentEvent) => {
    switch (event.type) {
      case 'text':
      case 'reasoning':
        setItems((current) => {
          const last = current[current.length - 1]
          const field = event.type === 'text' ? 'text' : 'reasoning'
          if (last?.kind === 'assistant' && !last.done) {
            return [...current.slice(0, -1), { ...last, [field]: last[field] + event.delta }]
          }
          return [
            ...current,
            {
              kind: 'assistant',
              id: nextId(),
              text: '',
              reasoning: '',
              done: false,
              [field]: event.delta,
            },
          ]
        })
        break
      case 'message-end':
        setItems((current) => {
          const last = current[current.length - 1]
          if (last?.kind !== 'assistant' || last.done) return current
          // 只调用了工具、没有正文也没有思考内容的回复不单独展示
          if (!last.text.trim() && !last.reasoning.trim()) return current.slice(0, -1)
          return [...current.slice(0, -1), { ...last, done: true }]
        })
        break
      case 'tool-start': {
        const id = nextId()
        toolItemIdsRef.current.set(event.callId, id)
        setItems((current) => [
          ...current,
          { kind: 'tool', id, name: event.name, args: event.args, status: 'running' },
        ])
        break
      }
      case 'tool-end':
        updateTool(toolItemIdsRef.current.get(event.callId) ?? '', {
          status: event.status,
          result: event.result,
        })
        break
    }
  }

  const confirm = (tool: FrameTool, callId: string): Promise<boolean> => {
    if (tool.readOnly || !confirmTools) return Promise.resolve(true)
    const itemId = toolItemIdsRef.current.get(callId) ?? callId
    updateTool(itemId, { status: 'awaiting' })
    return new Promise((resolve) => {
      confirmsRef.current.set(itemId, (allowed) => {
        confirmsRef.current.delete(itemId)
        updateTool(itemId, { status: allowed ? 'running' : 'rejected' })
        resolve(allowed)
      })
    })
  }

  const execute = async (targetTab: number, tool: FrameTool, args: unknown) => {
    if (!isBuiltinTool(tool)) return executeFrameTool(targetTab, tool.frameId, tool.name, args)
    try {
      return { ok: true, result: formatPageContent(await readPage(targetTab)) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  const send = async (prompt: Prompt) => {
    if (!prompt.text.trim() || running || tabId == null || !configReady) return

    stickToBottomRef.current = true
    setItems((current) => [
      ...current,
      {
        kind: 'user',
        id: nextId(),
        text: prompt.text,
        quote: prompt.quote,
        withPage: prompt.withPage,
      },
    ])

    const controller = new AbortController()
    abortRef.current = controller
    toolItemIdsRef.current.clear()
    setRunning(true)
    const targetTab = tabId

    try {
      let content = prompt.quote
        ? `关于下面这段选中的内容：\n${quoteBlock(prompt.quote)}\n\n${prompt.text}`
        : prompt.text
      // 快捷指令直接附带网页正文，省去一次工具调用，工具调用能力弱的模型也能用
      if (prompt.withPage) {
        content = `${content}\n\n${formatPageContent(await readPage(targetTab))}`
      }
      historyRef.current.push({ role: 'user', content })

      await runAgent({
        config,
        apiKey,
        history: historyRef.current,
        systemPrompt: buildSystemPrompt(page, webTools.length, config.prompt),
        getTools: () => toolsRef.current,
        execute: (tool, args) => execute(targetTab, tool, args),
        confirm,
        onEvent: handleEvent,
        signal: controller.signal,
      })
    } catch (error) {
      const aborted = controller.signal.aborted
      setItems((current) => [
        ...current.map((item) =>
          item.kind === 'assistant' && !item.done ? { ...item, done: true } : item,
        ),
        { kind: 'error', id: nextId(), text: aborted ? '已停止' : describeError(error) },
      ])
    } finally {
      repairHistory(historyRef.current)
      confirmsRef.current.forEach((resolve) => resolve(false))
      abortRef.current = null
      setRunning(false)
    }
  }

  const submit = () => {
    const text = input.trim()
    if (!text || running) return
    setInput('')
    setQuote('')
    void send({ text, quote: quote || undefined })
  }

  const stop = () => {
    abortRef.current?.abort()
    confirmsRef.current.forEach((resolve) => resolve(false))
  }

  const clear = useCallback(() => {
    abortRef.current?.abort()
    confirmsRef.current.forEach((resolve) => resolve(false))
    historyRef.current = []
    setItems([])
  }, [])

  /** 接手划词内容：带着已有问答时开启新对话，否则把选中文字作为引用放进输入框 */
  const acceptHandoff = useCallback(
    (handoff: AssistantHandoff) => {
      setView('chat')
      if (handoff.exchange) {
        clear()
        const question = `${handoff.exchange.question}：\n${quoteBlock(handoff.quote)}`
        historyRef.current = [
          { role: 'user', content: question },
          { role: 'assistant', content: handoff.exchange.answer },
        ]
        setItems([
          { kind: 'user', id: nextId(), text: handoff.exchange.question, quote: handoff.quote },
          {
            kind: 'assistant',
            id: nextId(),
            text: handoff.exchange.answer,
            reasoning: '',
            done: true,
          },
        ])
        setQuote('')
      } else {
        setQuote(handoff.quote)
      }
      window.setTimeout(() => inputRef.current?.focus(), 50)
    },
    [clear],
  )

  // 划词「问 AI」：侧边栏打开时或已打开时都会收到交接内容，读取后清空，避免重复处理
  useEffect(() => {
    const consume = (handoff: AssistantHandoff | null) => {
      if (!handoff) return
      void assistantHandoff.setValue(null)
      acceptHandoff(handoff)
    }
    void assistantHandoff.getValue().then(consume)
    return assistantHandoff.watch(consume)
  }, [acceptHandoff])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const host = hostOf(page.url)
  const placeholder = useMemo(() => {
    if (!configReady) return '先在设置里配置对话模型'
    if (quote) return '就选中的内容提问…'
    return webTools.length
      ? '问问这个网页，或让 AI 用网页工具帮你做点什么…'
      : '问问这个网页，比如「这篇文章的结论是什么」'
  }, [configReady, quote, webTools.length])

  return (
    <div className='sidepanel-shell flex h-full flex-col text-neutral-800'>
      <header className='flex shrink-0 items-center justify-between gap-2 border-b border-black/5 px-3 py-2'>
        {/* 浏览器侧边栏自带扩展图标与名称，这里只交代助手当前读的是哪个网页 */}
        <div className='flex min-w-0 items-center gap-2' title={page.url}>
          <Globe className='size-4 shrink-0 text-neutral-500' strokeWidth={1.8} aria-hidden />
          <div className='min-w-0'>
            <p className='truncate text-[13px] font-medium text-neutral-900'>
              {page.title || host || '当前页面'}
            </p>
            {(host || webTools.length > 0) && (
              <p className='truncate text-[11px] text-neutral-500'>
                {host}
                {webTools.length > 0 && `${host ? ' · ' : ''}${webTools.length} 个网页工具`}
              </p>
            )}
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          {view === 'chat' && items.length > 0 && (
            <IconButton label='新对话' onClick={clear}>
              <SquarePen strokeWidth={1.8} />
            </IconButton>
          )}
          <IconButton
            label={view === 'chat' ? '设置' : '返回对话'}
            onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}
            disabled={view === 'settings' && !configReady}
          >
            {view === 'chat' ? <Settings strokeWidth={1.8} /> : <ArrowLeft strokeWidth={1.8} />}
          </IconButton>
        </div>
      </header>

      {view === 'settings' ? (
        <SettingsView
          inherited={inherited}
          confirmTools={confirmTools}
          setConfirmTools={setConfirmTools}
          webmcpSupported={status !== 'unsupported'}
          onSaved={() => setView('chat')}
        />
      ) : (
        <>
          {webTools.length > 0 && (
            <ToolsPanel
              tools={webTools}
              status={status}
              onRefresh={refresh}
              execute={(tool, args) =>
                tabId == null
                  ? Promise.resolve({ ok: false, error: '没有可用的标签页' })
                  : executeFrameTool(tabId, tool.frameId, tool.name, args)
              }
            />
          )}

          <div
            ref={scrollRef}
            onScroll={(event) => {
              const el = event.currentTarget
              stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
            }}
            className='min-h-0 flex-1 overflow-y-auto px-3 py-3'
          >
            {items.length === 0 ? (
              <EmptyState
                disabled={!configReady || running || tabId == null}
                webToolCount={webTools.length}
                onQuickAction={(prompt) => void send({ text: prompt, withPage: true })}
              />
            ) : (
              <div className='flex flex-col gap-2.5'>
                {items.map((item) => (
                  <ChatRow
                    key={item.id}
                    item={item}
                    onDecide={(allowed) => confirmsRef.current.get(item.id)?.(allowed)}
                  />
                ))}
                {running && items[items.length - 1]?.kind !== 'assistant' && (
                  <p className='animate-pulse text-xs text-neutral-500'>思考中…</p>
                )}
              </div>
            )}
          </div>

          <footer className='shrink-0 border-t border-black/5 p-2.5'>
            {items.length > 0 && !running && (
              <div className='mb-2 flex flex-wrap gap-1.5'>
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    type='button'
                    disabled={!configReady}
                    onClick={() => void send({ text: action.prompt, withPage: true })}
                    className='inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] text-neutral-600 transition-colors hover:bg-black/5 hover:text-neutral-900 disabled:opacity-50'
                  >
                    <action.icon className='size-3' aria-hidden />
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            <div className='flex flex-col gap-1.5 ui-composer rounded-2xl px-3 py-2 transition-shadow'>
              {quote && (
                <div className='flex items-start gap-1.5 rounded-md bg-neutral-50 px-2 py-1 text-[11px] text-neutral-500'>
                  <span className='line-clamp-3 flex-1 border-l-2 border-accent-300 pl-1.5 whitespace-pre-wrap'>
                    {quote}
                  </span>
                  <button
                    type='button'
                    title='移除引用'
                    onClick={() => setQuote('')}
                    className='shrink-0 text-neutral-500 hover:text-neutral-600'
                  >
                    <X className='size-3.5' aria-hidden />
                  </button>
                </div>
              )}
              <div className='flex items-end gap-2'>
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={2}
                  disabled={!configReady}
                  placeholder={placeholder}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  className='max-h-40 min-h-10 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed'
                />
                {running ? (
                  <button
                    type='button'
                    title='停止'
                    aria-label='停止'
                    onClick={stop}
                    className='flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700'
                  >
                    <Square className='size-3 fill-current' aria-hidden />
                  </button>
                ) : (
                  <button
                    type='button'
                    title='发送'
                    aria-label='发送'
                    onClick={submit}
                    disabled={!input.trim() || !configReady || tabId == null}
                    className='flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-neutral-400'
                  >
                    <ArrowUp className='size-4' strokeWidth={2.2} aria-hidden />
                  </button>
                )}
              </div>
            </div>
            <p className='mt-1 px-1 text-[10px] text-neutral-500'>
              {config.model ? `${config.model} · ` : ''}Enter 发送，Shift + Enter 换行
            </p>
          </footer>
        </>
      )}
    </div>
  )
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('无法读取当前网页')) return error.message
  const translateError = toTranslateError(error)
  const friendly = describeServiceError(translateError.code)
  return translateError.message && translateError.message !== friendly
    ? `${friendly}：${translateError.message}`
    : friendly
}

function SettingsView({
  inherited,
  confirmTools,
  setConfirmTools,
  webmcpSupported,
  onSaved,
}: {
  inherited: boolean
  confirmTools: boolean
  setConfirmTools: (value: boolean) => void
  webmcpSupported: boolean
  onSaved: () => void
}) {
  return (
    <div className='popup-main min-h-0 flex-1 overflow-y-auto px-3 py-3'>
      <section className='flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3'>
        <div>
          <h2 className='text-sm font-semibold'>对话模型</h2>
          <p className='text-[11px] leading-relaxed text-neutral-500'>
            用于侧边栏助手和划词的解释、总结、润色，建议选能力强、支持工具调用的模型。
            翻译模型在设置页单独配置，可以选更快的模型。
            {inherited && '当前沿用翻译模型，保存后单独生效。'}
          </p>
        </div>
        <LlmConfigForm compact target='assistant' onSaved={onSaved} />
      </section>
      <section className='mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5'>
        <div className='min-w-0'>
          <p className='text-sm font-medium'>执行网页工具前确认</p>
          <p className='text-[11px] leading-relaxed text-neutral-500'>
            网页通过 WebMCP 提供、且未声明为只读的工具（可能提交表单、下单等），执行前先让你确认
            {!webmcpSupported &&
              '。浏览器尚未开启 WebMCP：在 chrome://flags 启用「WebMCP for testing」后可用'}
          </p>
        </div>
        <Switch checked={confirmTools} onChange={setConfirmTools} />
      </section>
      <button
        type='button'
        onClick={() =>
          void sendRuntimeMessage({ type: 'open-options-page' }).catch(() => undefined)
        }
        className='mt-3 w-full text-center text-[11px] text-neutral-500 hover:text-accent-600'
      >
        打开完整设置页
        <ArrowUpRight className='ml-0.5 inline size-3 -translate-y-px' aria-hidden />
      </button>
    </div>
  )
}

function EmptyState({
  disabled,
  webToolCount,
  onQuickAction,
}: {
  disabled: boolean
  webToolCount: number
  onQuickAction: (prompt: string) => void
}) {
  return (
    <div className='flex flex-col items-center gap-4 pt-10 text-center'>
      <span className='flex size-10 items-center justify-center rounded-full bg-black/5 text-neutral-700'>
        <Sparkles className='size-5' strokeWidth={1.8} aria-hidden />
      </span>
      <div className='flex flex-col gap-1'>
        <p className='text-[15px] font-semibold text-neutral-900'>有什么可以帮你？</p>
        <p className='text-xs leading-relaxed text-neutral-500'>
          可以总结网页、就网页内容提问；在网页上选中文字后点「问 AI」，会带着选中内容来这里。
          {webToolCount > 0 && `当前网页还提供了 ${webToolCount} 个工具，AI 可以替你在网页上操作。`}
        </p>
      </div>
      <div className='flex w-full flex-col gap-1.5'>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type='button'
            disabled={disabled}
            onClick={() => onQuickAction(action.prompt)}
            className='flex items-start gap-2.5 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-left text-xs transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50'
          >
            <action.icon
              className='mt-px size-4 shrink-0 text-neutral-500'
              strokeWidth={1.8}
              aria-hidden
            />
            <span className='min-w-0'>
              <span className='block font-medium text-neutral-900'>{action.label}</span>
              <span className='mt-0.5 block leading-relaxed text-neutral-500'>{action.prompt}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ChatRow({ item, onDecide }: { item: ChatItem; onDecide: (allowed: boolean) => void }) {
  if (item.kind === 'user') {
    const label = QUICK_ACTIONS.find((action) => action.prompt === item.text)?.label
    return (
      <div className='ml-8 flex flex-col items-end gap-1 self-end'>
        {item.quote && (
          <p className='line-clamp-4 max-w-full rounded-lg border-l-2 border-accent-300 bg-white/70 px-2 py-1 text-[11px] whitespace-pre-wrap text-neutral-500'>
            {item.quote}
          </p>
        )}
        <div className='rounded-2xl rounded-br-md bg-neutral-100 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words text-neutral-900'>
          {label ?? item.text}
        </div>
        {item.withPage && (
          <span className='inline-flex items-center gap-1 text-[10px] text-neutral-500'>
            <FileText className='size-3' aria-hidden />
            已附带网页内容
          </span>
        )}
      </div>
    )
  }

  if (item.kind === 'error') {
    return (
      <div className='rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed break-words text-rose-700'>
        {item.text}
      </div>
    )
  }

  if (item.kind === 'assistant') {
    return (
      <div className='mr-4 flex flex-col gap-1'>
        {item.reasoning && (
          <details className='text-[11px] text-neutral-500' open={!item.done && !item.text}>
            <summary className='cursor-pointer select-none'>思考过程</summary>
            <p className='mt-1 border-l-2 border-neutral-200 pl-2 whitespace-pre-wrap break-words'>
              {item.reasoning}
            </p>
          </details>
        )}
        {item.text && (
          <div className='px-1 py-1 text-sm leading-relaxed text-neutral-900'>
            <Markdown text={item.text} />
          </div>
        )}
      </div>
    )
  }

  const tone =
    item.status === 'error'
      ? 'text-rose-600'
      : item.status === 'awaiting'
        ? 'text-amber-600'
        : item.status === 'done'
          ? 'text-emerald-600'
          : 'text-neutral-500'
  const displayName = item.name === READ_PAGE_TOOL.name ? '读取网页内容' : item.name

  return (
    <div className='mr-4 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs'>
      <div className='flex items-center justify-between gap-2'>
        <span className='flex min-w-0 items-center gap-1.5 font-mono font-medium text-neutral-700'>
          <Wrench className='size-3.5 shrink-0 text-neutral-500' aria-hidden />
          <span className='truncate'>{displayName}</span>
        </span>
        <span className={`shrink-0 ${tone}`}>{TOOL_STATUS_LABELS[item.status]}</span>
      </div>
      <details className='mt-1' open={item.status === 'awaiting'}>
        <summary className='cursor-pointer select-none text-neutral-500'>参数与结果</summary>
        <pre className='mt-1 max-h-32 overflow-auto rounded bg-neutral-50 p-1.5 font-mono text-[11px] whitespace-pre-wrap break-all text-neutral-600'>
          {formatJson(item.args)}
        </pre>
        {item.result != null && (
          <pre className='mt-1 max-h-48 overflow-auto rounded bg-neutral-50 p-1.5 font-mono text-[11px] whitespace-pre-wrap break-all text-neutral-600'>
            {formatJson(item.result)}
          </pre>
        )}
      </details>
      {item.status === 'awaiting' && (
        <div className='mt-2 flex items-center justify-end gap-1.5'>
          <span className='mr-auto text-[11px] text-amber-600'>该工具可能修改网页数据</span>
          <Button onClick={() => onDecide(false)} className='!px-2 !py-0.5 text-xs'>
            拒绝
          </Button>
          <Button
            variant='primary'
            onClick={() => onDecide(true)}
            className='!px-2 !py-0.5 text-xs'
          >
            允许执行
          </Button>
        </div>
      )}
    </div>
  )
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
