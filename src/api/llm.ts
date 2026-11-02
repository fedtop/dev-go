/**
 * OpenAI 兼容的 Chat Completions 客户端（流式 SSE）。
 *
 * 运行在 Background：扩展拥有 <all_urls> 主机权限，跨域请求不受页面 CORS 限制。
 * 兼容 OpenAI / DeepSeek / 通义 / 火山方舟 / Moonshot / OpenRouter / Ollama 等实现；
 * 若服务端忽略 stream 参数直接返回 JSON，也能正常解析。
 */

import { httpStatusToError, TranslateError } from '@/features/translate/errors'
import {
  isLlmConfigReady,
  resolveChatCompletionsUrl,
  resolveModelsUrl,
  type LlmConfig,
} from '@/features/translate/llm-config'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  config: LlmConfig
  apiKey: string
  messages: ChatMessage[]
  signal?: AbortSignal
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: { content?: string | null }
    message?: { content?: string | null }
  }>
  error?: { message?: string } | string
}

const ERROR_DETAIL_LIMIT = 300

function readErrorMessage(payload: ChatCompletionChunk['error']): string {
  if (!payload) return ''
  return typeof payload === 'string' ? payload : (payload.message ?? '')
}

async function readResponseError(res: Response): Promise<string> {
  const raw = (await res.text().catch(() => '')).trim()
  try {
    const parsed = JSON.parse(raw) as ChatCompletionChunk
    const message = readErrorMessage(parsed.error)
    if (message) return message.slice(0, ERROR_DETAIL_LIMIT)
  } catch {
    // 非 JSON 错误体，直接截取原文
  }
  return raw.slice(0, ERROR_DETAIL_LIMIT)
}

function parseChunk(data: string): string {
  let chunk: ChatCompletionChunk
  try {
    chunk = JSON.parse(data) as ChatCompletionChunk
  } catch {
    return ''
  }

  const errorMessage = readErrorMessage(chunk.error)
  if (errorMessage) throw new TranslateError('server', errorMessage)

  const choice = chunk.choices?.[0]
  return choice?.delta?.content ?? choice?.message?.content ?? ''
}

/** 逐个产出 SSE 事件的 data 字段（多行 data 按规范以换行拼接） */
async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let dataLines: string[] = []

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })

      let newlineIndex = buffer.search(/\r?\n/)
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(buffer[newlineIndex] === '\r' ? newlineIndex + 2 : newlineIndex + 1)

        if (line === '') {
          if (dataLines.length) yield dataLines.join('\n')
          dataLines = []
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''))
        }
        newlineIndex = buffer.search(/\r?\n/)
      }

      if (done) break
    }

    if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).replace(/^ /, ''))
    if (dataLines.length) yield dataLines.join('\n')
  } finally {
    reader.releaseLock()
  }
}

/** 流式调用 Chat Completions，逐段产出模型输出的文本增量 */
export async function* streamChatCompletion(
  request: ChatCompletionRequest,
): AsyncGenerator<string> {
  const { config, apiKey, messages, signal } = request
  if (!isLlmConfigReady(config)) {
    throw new TranslateError('config', 'AI 翻译未配置：请在设置中填写接口地址和模型')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json',
  }
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`

  const res = await fetch(resolveChatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: config.model.trim(), messages, stream: true }),
    signal,
  })

  if (!res.ok) throw httpStatusToError(res.status, await readResponseError(res))

  const contentType = res.headers.get('content-type') ?? ''
  if (!res.body || contentType.includes('application/json')) {
    // 服务端未开启流式：整段返回
    const content = parseChunk(await res.text())
    if (content) yield content
    return
  }

  for await (const data of readSseData(res.body)) {
    if (data.trim() === '[DONE]') return
    const content = parseChunk(data)
    if (content) yield content
  }
}

/** 非流式便捷调用：拼接全部增量 */
export async function completeChat(request: ChatCompletionRequest): Promise<string> {
  let output = ''
  for await (const delta of streamChatCompletion(request)) output += delta
  return output
}

const LIST_MODELS_TIMEOUT_MS = 10_000

interface ModelListResponse {
  /** OpenAI 及多数兼容实现 */
  data?: Array<{ id?: string; name?: string }>
  /** 少数实现直接返回 models 数组 */
  models?: Array<{ id?: string; name?: string } | string>
}

/**
 * 拉取服务端可用模型（OpenAI 兼容：GET {base}/models），按名称排序去重。
 * 并非所有服务都实现了该接口，失败时抛 TranslateError，由调用方回落到预设候选。
 */
export async function listModels(baseUrl: string, apiKey: string): Promise<string[]> {
  if (!baseUrl.trim()) throw new TranslateError('config', '请先填写接口地址')

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`

  const res = await fetch(resolveModelsUrl(baseUrl), {
    headers,
    signal: AbortSignal.timeout(LIST_MODELS_TIMEOUT_MS),
  })
  if (!res.ok) throw httpStatusToError(res.status, await readResponseError(res))

  const body = (await res.json()) as ModelListResponse
  const entries = body.data ?? body.models ?? []
  const ids = entries
    .map((entry) => (typeof entry === 'string' ? entry : (entry.id ?? entry.name ?? '')))
    .filter((id): id is string => Boolean(id))

  return [...new Set(ids)].sort((a, b) => a.localeCompare(b))
}

/* ------------------------------ 工具调用（Function Calling） ------------------------------ */

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: unknown
  }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** 支持工具调用的对话消息（OpenAI Chat Completions 格式） */
export type AgentMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export interface ToolChatRequest {
  config: LlmConfig
  apiKey: string
  messages: AgentMessage[]
  tools: ToolDefinition[]
  signal?: AbortSignal
  /** 回答正文的增量 */
  onText?: (delta: string) => void
  /** 思考过程的增量（GLM / DeepSeek / Kimi 等以 reasoning_content 返回） */
  onReasoning?: (delta: string) => void
}

export interface ToolChatResult {
  content: string
  toolCalls: ToolCall[]
}

interface ToolCallDelta {
  index?: number
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

interface ToolChatChunk {
  choices?: Array<{
    delta?: {
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: ToolCallDelta[]
    }
    message?: {
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: ToolCallDelta[]
    }
  }>
  error?: { message?: string } | string
}

/**
 * 流式调用 Chat Completions 并支持工具调用：正文 / 思考增量通过回调实时推送，
 * 分片到达的 tool_calls 按 index 拼装，结束后一并返回。服务端忽略 stream 时也能解析整段 JSON。
 */
export async function chatWithTools(request: ToolChatRequest): Promise<ToolChatResult> {
  const { config, apiKey, messages, tools, signal, onText, onReasoning } = request
  if (!isLlmConfigReady(config)) {
    throw new TranslateError('config', 'AI 未配置：请填写接口地址和模型')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json',
  }
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`

  const res = await fetch(resolveChatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers,
    // 空工具数组会被部分服务判为参数错误，没有工具时不传
    body: JSON.stringify({
      model: config.model.trim(),
      messages,
      stream: true,
      ...(tools.length ? { tools } : {}),
    }),
    signal,
  })
  if (!res.ok) throw httpStatusToError(res.status, await readResponseError(res))

  let content = ''
  const calls: Array<{ id: string; name: string; arguments: string }> = []

  const consume = (data: string) => {
    let chunk: ToolChatChunk
    try {
      chunk = JSON.parse(data) as ToolChatChunk
    } catch {
      return
    }
    const errorMessage = readErrorMessage(chunk.error)
    if (errorMessage) throw new TranslateError('server', errorMessage)

    const choice = chunk.choices?.[0]
    const part = choice?.delta ?? choice?.message
    if (!part) return

    if (part.reasoning_content) onReasoning?.(part.reasoning_content)
    if (part.content) {
      content += part.content
      onText?.(part.content)
    }
    part.tool_calls?.forEach((delta, position) => {
      const index = delta.index ?? position
      const call = (calls[index] ??= { id: '', name: '', arguments: '' })
      if (delta.id) call.id = delta.id
      const name = delta.function?.name
      // 多数服务只在首个分片给出完整函数名，少数实现每个分片都重复完整名称
      if (name) call.name = call.name && name.startsWith(call.name) ? name : call.name + name
      if (delta.function?.arguments) call.arguments += delta.function.arguments
    })
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!res.body || contentType.includes('application/json')) {
    consume(await res.text())
  } else {
    for await (const data of readSseData(res.body)) {
      if (data.trim() === '[DONE]') break
      consume(data)
    }
  }

  return {
    content,
    toolCalls: calls
      .filter((call) => call?.name)
      .map((call, index) => ({
        id: call.id || `call_${index}`,
        type: 'function' as const,
        function: { name: call.name, arguments: call.arguments || '{}' },
      })),
  }
}
