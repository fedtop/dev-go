/**
 * 划词 AI 与侧边栏助手的后台能力：
 * - 划词 AI 动作：内容脚本受网页 CORS 限制，请求由后台发出，经长连接流式回传；
 * - 打开侧边栏并把划词内容交给助手；
 * - 测试对话模型（连通性 + 工具调用能力）。
 */
import { chatWithTools } from '@/api/llm'
import { buildSelectionMessages } from '@/features/ai/actions'
import { readChatModel } from '@/features/ai/model'
import { isAbortError, toTranslateError } from '@/features/translate/errors'
import type { LlmConfig } from '@/features/translate/llm-config'
import {
  isOpenAssistantMessage,
  type SelectionAiEvent,
  type SelectionAiRequest,
  type TranslateTestResult,
} from '@/utils/messaging'
import { assistantHandoff } from '@/utils/settings'

const MAX_SELECTION_CHARS = 8000
const TEST_TIMEOUT_MS = 30_000
const TEST_TOOL_NAME = 'get_current_time'

/** 一条连接执行一个动作；内容脚本关闭气泡即断开连接，请求随之取消 */
export function handleSelectionAiPort(port: Browser.runtime.Port) {
  const controller = new AbortController()
  const post = (event: SelectionAiEvent) => {
    if (controller.signal.aborted) return
    try {
      port.postMessage(event)
    } catch {
      controller.abort()
    }
  }

  port.onDisconnect.addListener(() => controller.abort())
  port.onMessage.addListener((request: SelectionAiRequest) => {
    if (request?.type !== 'run') return
    void (async () => {
      try {
        const { config, apiKey } = await readChatModel()
        await chatWithTools({
          config,
          apiKey,
          signal: controller.signal,
          tools: [],
          messages: buildSelectionMessages(
            request.action,
            request.text.slice(0, MAX_SELECTION_CHARS),
            request.context,
          ),
          onText: (delta) => post({ type: 'text', delta }),
          onReasoning: (delta) => post({ type: 'reasoning', delta }),
        })
        post({ type: 'done' })
      } catch (error) {
        if (!isAbortError(error)) post({ type: 'error', error: toTranslateError(error).toJSON() })
      }
    })()
  })
}

/**
 * 打开侧边栏并交接划词内容。必须同步调用 sidePanel.open（用户手势在第一个 await 后失效），
 * 交接内容随后写入 session 存储，侧边栏打开后读取。
 */
export function registerOpenAssistantListener() {
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (!isOpenAssistantMessage(message)) return false
    const windowId = sender.tab?.windowId
    if (windowId != null) {
      chrome.sidePanel?.open({ windowId }).catch((error: unknown) => {
        console.warn('[DevGo] open side panel failed:', error)
      })
    }
    void assistantHandoff.setValue(message.handoff)
    return false
  })
}

/** 用一个必须调用工具才能回答的问题，同时验证连通性与工具调用能力 */
export async function testAssistant(
  config: LlmConfig,
  apiKey: string,
): Promise<TranslateTestResult> {
  try {
    const { toolCalls } = await chatWithTools({
      config,
      apiKey,
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      messages: [
        {
          role: 'system',
          content: 'You can only learn the current time by calling the provided tool.',
        },
        { role: 'user', content: 'What time is it now? Use the tool.' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: TEST_TOOL_NAME,
            description: 'Returns the current local time.',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    })

    return toolCalls.some((call) => call.function.name === TEST_TOOL_NAME)
      ? { ok: true, sample: '连接成功，模型支持工具调用' }
      : {
          ok: true,
          warning: true,
          sample: '连接成功，但模型没有调用测试工具，可能不支持工具调用，建议换用更强的模型',
        }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { ok: false, error: { code: 'network', message: '请求超时' } }
    }
    return { ok: false, error: toTranslateError(error).toJSON() }
  }
}
