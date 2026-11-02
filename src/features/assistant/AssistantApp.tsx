import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import type { AgentMessage } from '@/api/llm'
import { isLlmConfigReady } from '@/features/translate/llm-config'
import LlmConfigForm from '@/features/translate/LlmConfigForm'
import { describeServiceError, toTranslateError } from '@/features/translate/errors'
import Button from '@/ui/Button'
import Switch from '@/ui/Switch'
import {
  assistantConfirmTools,
  assistantLlmApiKey,
  assistantLlmConfig,
  translateLlmApiKey,
  translateLlmConfig,
} from '@/utils/settings'
import { useStorageItem } from '@/utils/useStorageItem'

import { buildSystemPrompt, repairHistory, runAgent, type AgentEvent } from './agent'
import ToolsPanel from './ToolsPanel'
import {
  executeFrameTool,
  useActiveTabId,
  useWebmcpTools,
  type FrameTool,
  type ToolsStatus,
} from './webmcp-client'

type ToolStatus = 'running' | 'awaiting' | 'done' | 'error' | 'rejected'

type ChatItem =
  | { kind: 'user'; id: string; text: string }
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

const STATUS_HINTS: Record<Exclude<ToolsStatus, 'ready'>, string> = {
  loading: '正在读取网页工具…',
  unsupported: '浏览器还没开启 WebMCP。',
  unavailable: '当前页面无法使用：浏览器内置页面不支持；如果是安装扩展前打开的页面，刷新后再试。',
}

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

/** WebMCP 助手：列出网页注册的工具，让 AI 通过工具读取 / 操作网页 */
export default function AssistantApp() {
  const tabId = useActiveTabId()
  const { tools, status, page, refresh } = useWebmcpTools(tabId)

  const [assistantConfig, , assistantLoaded] = useStorageItem(assistantLlmConfig)
  const [assistantKey] = useStorageItem(assistantLlmApiKey)
  const [translateConfig, , translateLoaded] = useStorageItem(translateLlmConfig)
  const [translateKey] = useStorageItem(translateLlmApiKey)
  const [confirmTools, setConfirmTools] = useStorageItem(assistantConfirmTools)

  // 助手没单独保存过配置时沿用翻译的 AI 配置
  const config = assistantConfig ?? translateConfig
  const apiKey = assistantConfig ? assistantKey : translateKey
  const configReady = isLlmConfigReady(config)
  const loaded = assistantLoaded && translateLoaded

  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)

  const historyRef = useRef<AgentMessage[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const confirmsRef = useRef(new Map<string, (allowed: boolean) => void>())
  /** 模型给的调用 id 不保证全局唯一（未返回 id 时每步都是 call_0），界面另行分配 id */
  const toolItemIdsRef = useRef(new Map<string, string>())
  const toolsRef = useRef<FrameTool[]>(tools)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  toolsRef.current = tools

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
          {
            kind: 'tool',
            id,
            name: event.name,
            args: event.args,
            status: 'running',
          },
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

  const send = async () => {
    const text = input.trim()
    if (!text || running || tabId == null || !configReady) return

    setInput('')
    stickToBottomRef.current = true
    setItems((current) => [...current, { kind: 'user', id: nextId(), text }])
    historyRef.current.push({ role: 'user', content: text })

    const controller = new AbortController()
    abortRef.current = controller
    toolItemIdsRef.current.clear()
    setRunning(true)
    const targetTab = tabId

    try {
      await runAgent({
        config,
        apiKey,
        history: historyRef.current,
        systemPrompt: buildSystemPrompt(page, toolsRef.current.length, config.prompt),
        getTools: () => toolsRef.current,
        execute: (tool, args) => executeFrameTool(targetTab, tool.frameId, tool.name, args),
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
        {
          kind: 'error',
          id: nextId(),
          text: aborted ? '已停止' : describeError(error),
        },
      ])
    } finally {
      repairHistory(historyRef.current)
      confirmsRef.current.forEach((resolve) => resolve(false))
      abortRef.current = null
      setRunning(false)
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    confirmsRef.current.forEach((resolve) => resolve(false))
  }

  const clear = () => {
    stop()
    historyRef.current = []
    setItems([])
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  const host = hostOf(page.url)
  const statusHint = status === 'ready' ? '' : STATUS_HINTS[status]
  const placeholder = useMemo(() => {
    if (!configReady) return '先在设置里配置 AI 服务'
    return tools.length ? '让 AI 用网页工具帮你做点什么…' : '当前网页没有工具，也可以直接提问'
  }, [configReady, tools.length])

  return (
    <div className='sidepanel-shell flex h-full flex-col text-slate-800'>
      <header className='flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/70 px-3 py-2.5'>
        <div className='min-w-0'>
          <div className='flex items-center gap-1.5'>
            <img src='/icons/48.png' alt='' className='h-5 w-5' />
            <h1 className='text-sm font-semibold'>WebMCP 助手</h1>
          </div>
          <p className='truncate text-[11px] text-slate-400' title={page.url}>
            {host || '当前页面'}
            {status === 'ready' && ` · ${tools.length} 个工具`}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          {view === 'chat' && items.length > 0 && (
            <Button onClick={clear} className='!px-2 !py-1 text-xs'>
              新对话
            </Button>
          )}
          <Button
            onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}
            disabled={view === 'settings' && !configReady}
            className='!px-2 !py-1 text-xs'
          >
            {view === 'chat' ? '设置' : '返回'}
          </Button>
        </div>
      </header>

      {view === 'settings' ? (
        <div className='popup-main min-h-0 flex-1 overflow-y-auto px-3 py-3'>
          <section className='flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm'>
            <div>
              <h2 className='text-sm font-semibold'>AI 服务</h2>
              <p className='text-[11px] leading-relaxed text-slate-400'>
                兼容 OpenAI 接口的服务都可以用，包括各家 Coding Plan；模型需要支持工具调用。
              </p>
            </div>
            <LlmConfigForm compact target='assistant' onSaved={() => setView('chat')} />
          </section>
          <section className='mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm'>
            <div className='min-w-0'>
              <p className='text-sm font-medium'>执行前确认</p>
              <p className='text-[11px] leading-relaxed text-slate-400'>
                网页未声明为只读的工具（可能提交表单、下单等），执行前先让你确认
              </p>
            </div>
            <Switch checked={confirmTools} onChange={setConfirmTools} />
          </section>
        </div>
      ) : (
        <>
          <ToolsPanel
            tools={tools}
            status={status}
            onRefresh={refresh}
            execute={(tool, args) =>
              tabId == null
                ? Promise.resolve({ ok: false, error: '没有可用的标签页' })
                : executeFrameTool(tabId, tool.frameId, tool.name, args)
            }
          />

          <div
            ref={scrollRef}
            onScroll={(event) => {
              const el = event.currentTarget
              stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
            }}
            className='min-h-0 flex-1 overflow-y-auto px-3 py-3'
          >
            {items.length === 0 ? (
              <EmptyState statusHint={statusHint} status={status} toolCount={tools.length} />
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
                  <p className='animate-pulse text-xs text-slate-400'>思考中…</p>
                )}
              </div>
            )}
          </div>

          <footer className='shrink-0 border-t border-slate-200/70 p-2.5'>
            <div className='popup-field flex items-end gap-2 rounded-xl border bg-white px-2.5 py-2'>
              <textarea
                value={input}
                rows={2}
                disabled={!configReady}
                placeholder={placeholder}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                className='max-h-40 min-h-10 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-slate-400 disabled:cursor-not-allowed'
              />
              {running ? (
                <Button onClick={stop} className='shrink-0 !px-2.5 !py-1 text-xs'>
                  停止
                </Button>
              ) : (
                <Button
                  variant='primary'
                  onClick={() => void send()}
                  disabled={!input.trim() || !configReady || tabId == null}
                  className='shrink-0 !px-2.5 !py-1 text-xs'
                >
                  发送
                </Button>
              )}
            </div>
            <p className='mt-1 px-1 text-[10px] text-slate-400'>
              {config.model ? `${config.model} · ` : ''}Enter 发送，Shift + Enter 换行
            </p>
          </footer>
        </>
      )}
    </div>
  )
}

function describeError(error: unknown): string {
  const translateError = toTranslateError(error)
  const friendly = describeServiceError(translateError.code)
  return translateError.message && translateError.message !== friendly
    ? `${friendly}：${translateError.message}`
    : friendly
}

function EmptyState({
  status,
  statusHint,
  toolCount,
}: {
  status: ToolsStatus
  statusHint: string
  toolCount: number
}) {
  return (
    <div className='flex flex-col gap-2 pt-6 text-center text-xs leading-relaxed text-slate-400'>
      {status === 'unsupported' ? (
        <>
          <p>{statusHint}</p>
          <p>
            在地址栏打开{' '}
            <code className='rounded bg-slate-100 px-1'>chrome://flags/#enable-webmcp-testing</code>
            ，启用「WebMCP for testing」后重启浏览器（需要 Chrome 150 及以上）。
          </p>
        </>
      ) : statusHint ? (
        <p>{statusHint}</p>
      ) : toolCount ? (
        <p>当前网页提供了 {toolCount} 个工具，直接告诉 AI 你想做什么，它会自己选用工具。</p>
      ) : (
        <p>当前网页没有注册 WebMCP 工具。打开支持 WebMCP 的网站后，这里会自动列出可用工具。</p>
      )}
    </div>
  )
}

function ChatRow({ item, onDecide }: { item: ChatItem; onDecide: (allowed: boolean) => void }) {
  if (item.kind === 'user') {
    return (
      <div className='ml-8 self-end rounded-2xl rounded-br-md bg-indigo-600 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words text-white'>
        {item.text}
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
          <details className='text-[11px] text-slate-400' open={!item.done && !item.text}>
            <summary className='cursor-pointer select-none'>思考过程</summary>
            <p className='mt-1 border-l-2 border-slate-200 pl-2 whitespace-pre-wrap break-words'>
              {item.reasoning}
            </p>
          </details>
        )}
        {item.text && (
          <div className='rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm'>
            {item.text}
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
          : 'text-slate-400'

  return (
    <div className='mr-4 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2 text-xs shadow-sm'>
      <div className='flex items-center justify-between gap-2'>
        <span className='truncate font-mono font-medium text-slate-700'>🔧 {item.name}</span>
        <span className={`shrink-0 ${tone}`}>{TOOL_STATUS_LABELS[item.status]}</span>
      </div>
      <details className='mt-1' open={item.status === 'awaiting'}>
        <summary className='cursor-pointer select-none text-slate-400'>参数与结果</summary>
        <pre className='mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-1.5 font-mono text-[11px] whitespace-pre-wrap break-all text-slate-600'>
          {formatJson(item.args)}
        </pre>
        {item.result != null && (
          <pre className='mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-1.5 font-mono text-[11px] whitespace-pre-wrap break-all text-slate-600'>
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
