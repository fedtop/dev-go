/**
 * WebMCP 助手的 Agent 循环：模型选择网页工具 → 执行 → 把结果交回模型，直到给出最终回答。
 *
 * 只依赖 OpenAI 兼容的 Chat Completions + Function Calling，各家服务（含 Coding Plan）通用。
 */
import { chatWithTools, type AgentMessage, type ToolDefinition } from '@/api/llm'
import type { LlmConfig } from '@/features/translate/llm-config'
import type { WebmcpExecuteResult } from '@/utils/messaging'

import type { FrameTool, PageInfo } from './webmcp-client'

/** 单轮对话里模型最多连续调用工具的次数，防止死循环 */
const MAX_STEPS = 16
/** 交给模型的工具结果上限（过长的结果会挤占上下文） */
const MAX_RESULT_CHARS = 20_000
/** OpenAI 规范：函数名只能包含字母数字下划线连字符，最长 64 */
const FUNCTION_NAME_MAX = 64

export interface BoundTool {
  /** 发给模型的函数名（唯一、符合规范） */
  functionName: string
  tool: FrameTool
}

/** 把网页工具映射成合法且唯一的函数名；同名工具出现在多个 frame 时追加序号 */
export function bindTools(tools: FrameTool[]): BoundTool[] {
  const used = new Set<string>()
  return tools.map((tool) => {
    const base = tool.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, FUNCTION_NAME_MAX - 4) || 'tool'
    let functionName = base
    for (let index = 2; used.has(functionName); index += 1) functionName = `${base}_${index}`
    used.add(functionName)
    return { functionName, tool }
  })
}

function toDefinitions(bound: BoundTool[]): ToolDefinition[] {
  return bound.map(({ functionName, tool }) => ({
    type: 'function',
    function: {
      name: functionName,
      description: tool.description || tool.name,
      parameters:
        tool.inputSchema && typeof tool.inputSchema === 'object'
          ? tool.inputSchema
          : { type: 'object', properties: {} },
    },
  }))
}

export function buildSystemPrompt(page: PageInfo, toolCount: number, extra: string): string {
  const now = new Date()
  const date = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
  const lines = [
    '你是 DevGo 浏览器扩展侧边栏里的助手，帮助用户理解和操作当前网页。',
    `当前网页：${page.title || '（无标题）'}（${page.url || '未知地址'}）`,
    `现在是 ${date} ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}，时区 ${Intl.DateTimeFormat().resolvedOptions().timeZone}。`,
    toolCount
      ? `网页通过 WebMCP 提供了 ${toolCount} 个工具。需要读取网页信息或在网页上执行操作时，调用这些工具完成，不要编造工具、参数或结果。`
      : '当前网页没有提供 WebMCP 工具，你无法读取或操作网页，只能直接回答。',
    '用户提到相对日期（明天、下周一等）时，先换算成具体日期再传给工具。',
    '工具报错时根据错误调整参数重试一次或向用户说明原因，不要反复重试同一个调用。',
    '使用与用户相同的语言回答，简洁明了。',
  ]
  if (extra.trim()) lines.push(`额外要求：${extra.trim()}`)
  return lines.join('\n')
}

/** 推给界面的过程事件 */
export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  /** 模型完成一次回复（可能紧接着调用工具） */
  | { type: 'message-end' }
  | { type: 'tool-start'; callId: string; name: string; args: string }
  | {
      type: 'tool-end'
      callId: string
      status: 'done' | 'error' | 'rejected'
      result: string
    }

export interface RunAgentOptions {
  config: LlmConfig
  apiKey: string
  /** 截至本轮的对话历史（不含系统提示词），会被追加本轮产生的消息 */
  history: AgentMessage[]
  systemPrompt: string
  /** 每一步都重新读取：网页可能在对话过程中增删工具 */
  getTools: () => FrameTool[]
  execute: (tool: FrameTool, args: unknown) => Promise<WebmcpExecuteResult>
  /** 返回 false 表示用户拒绝执行 */
  confirm: (tool: FrameTool, callId: string) => Promise<boolean>
  onEvent: (event: AgentEvent) => void
  signal: AbortSignal
}

function truncate(text: string): string {
  return text.length > MAX_RESULT_CHARS
    ? `${text.slice(0, MAX_RESULT_CHARS)}\n…（结果过长，已截断）`
    : text
}

function parseArguments(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: raw.trim() ? JSON.parse(raw) : {} }
  } catch {
    return { ok: false, error: `参数不是合法的 JSON：${raw.slice(0, 200)}` }
  }
}

/** 执行一轮对话：直到模型不再调用工具，或达到步数上限 / 被取消 */
export async function runAgent(options: RunAgentOptions): Promise<void> {
  const { config, apiKey, history, systemPrompt, getTools, execute, confirm, onEvent, signal } =
    options

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const bound = bindTools(getTools())
    const result = await chatWithTools({
      config,
      apiKey,
      signal,
      tools: toDefinitions(bound),
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      onText: (delta) => onEvent({ type: 'text', delta }),
      onReasoning: (delta) => onEvent({ type: 'reasoning', delta }),
    })
    onEvent({ type: 'message-end' })

    history.push({
      role: 'assistant',
      content: result.content,
      ...(result.toolCalls.length ? { tool_calls: result.toolCalls } : {}),
    })
    if (!result.toolCalls.length) return

    for (const call of result.toolCalls) {
      signal.throwIfAborted()
      const target = bound.find((item) => item.functionName === call.function.name)
      const respond = (status: 'done' | 'error' | 'rejected', content: string) => {
        onEvent({ type: 'tool-end', callId: call.id, status, result: content })
        history.push({ role: 'tool', tool_call_id: call.id, content: truncate(content) })
      }

      onEvent({
        type: 'tool-start',
        callId: call.id,
        name: target?.tool.name ?? call.function.name,
        args: call.function.arguments,
      })
      if (!target) {
        respond('error', `工具「${call.function.name}」不存在，请只使用提供的工具`)
        continue
      }

      const args = parseArguments(call.function.arguments)
      if (!args.ok) {
        respond('error', args.error)
        continue
      }
      if (!(await confirm(target.tool, call.id))) {
        respond('rejected', '用户拒绝执行该工具')
        continue
      }

      const outcome = await execute(target.tool, args.value)
      if (outcome.ok) respond('done', outcome.result ?? '（工具执行成功，没有返回值）')
      else respond('error', outcome.error ?? '工具执行失败')
    }
  }

  history.push({
    role: 'assistant',
    content: `已连续调用工具 ${MAX_STEPS} 次仍未完成，先停在这里。可以补充说明后继续。`,
  })
  onEvent({ type: 'text', delta: `已连续调用工具 ${MAX_STEPS} 次仍未完成，先停在这里。` })
  onEvent({ type: 'message-end' })
}

/**
 * 中途取消时，历史里可能留下没有对应结果的 tool_calls；多数服务会因此拒绝下一次请求。
 * 为缺失的调用补上「已取消」结果，保证历史可以继续使用。
 */
export function repairHistory(history: AgentMessage[]): void {
  const answered = new Set(
    history.flatMap((message) => (message.role === 'tool' ? [message.tool_call_id] : [])),
  )
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== 'assistant' || !message.tool_calls) continue
    const missing = message.tool_calls.filter((call) => !answered.has(call.id))
    if (!missing.length) continue
    // 补在这条回复后面紧跟的工具结果之后
    let insertAt = index + 1
    while (history[insertAt]?.role === 'tool') insertAt += 1
    history.splice(
      insertAt,
      0,
      ...missing.map((call) => ({
        role: 'tool' as const,
        tool_call_id: call.id,
        content: '用户已取消',
      })),
    )
  }
}
