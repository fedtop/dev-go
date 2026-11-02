/**
 * WebMCP 助手的后台能力：测试模型配置。对话与工具调用在侧边栏页面内进行（见 features/assistant）。
 */
import { chatWithTools } from '@/api/llm'
import { toTranslateError } from '@/features/translate/errors'
import type { LlmConfig } from '@/features/translate/llm-config'
import type { TranslateTestResult } from '@/utils/messaging'

const TEST_TIMEOUT_MS = 30_000
const TEST_TOOL_NAME = 'get_current_time'

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
