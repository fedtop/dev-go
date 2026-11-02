/**
 * WebMCP 桥：读取网页通过 WebMCP 注册的工具，并代侧边栏执行。
 *
 * 依赖 Chrome 实验接口 document.modelContext（需在 chrome://flags 开启「WebMCP for testing」）。
 * 在每个 frame 中运行，只上报本 frame 自己注册的工具；侧边栏按 frameId 汇总、按 frameId 执行。
 * 未被侧边栏请求过的页面不做任何事，也不监听工具变化。
 */
import { hasExtensionRuntime } from '@/utils/content-settings'
import type {
  TabMessage,
  WebmcpExecuteResult,
  WebmcpFrameReport,
  WebmcpTool,
} from '@/utils/messaging'

interface ModelContextTool {
  name: string
  description?: string
  inputSchema?: unknown
  annotations?: Record<string, unknown>
  /** 注册该工具的 window（跨 frame 列举时用于区分归属） */
  window?: Window
}

interface ModelContext {
  getTools(options?: { fromOrigins?: string[] }): Promise<ModelContextTool[]>
  executeTool(tool: ModelContextTool, input: unknown): Promise<unknown>
  addEventListener?(type: string, listener: () => void): void
  ontoolchange?: (() => void) | null
}

const REPORT_DEBOUNCE_MS = 120

function getModelContext(): ModelContext | null {
  return (document as Document & { modelContext?: ModelContext }).modelContext ?? null
}

function parseSchema(schema: unknown): unknown {
  if (typeof schema !== 'string') return schema ?? null
  try {
    return JSON.parse(schema)
  } catch {
    return null
  }
}

/** 只取本 frame 注册的工具（未带 window 信息的实现视为本 frame） */
async function getOwnTools(context: ModelContext): Promise<ModelContextTool[]> {
  const tools = await context.getTools()
  return tools.filter((tool) => !tool.window || tool.window === window)
}

function serializeTool(tool: ModelContextTool): WebmcpTool {
  const annotations = tool.annotations ?? {}
  return {
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: parseSchema(tool.inputSchema),
    readOnly: annotations.readOnlyHint === true,
    annotations: Object.keys(annotations).filter((key) => annotations[key]),
  }
}

function serializeResult(value: unknown): string | null {
  if (value == null) return null
  return typeof value === 'string' ? value : JSON.stringify(value)
}

async function executeTool(
  context: ModelContext,
  name: string,
  args: unknown,
): Promise<WebmcpExecuteResult> {
  try {
    const tool = (await getOwnTools(context)).find((item) => item.name === name)
    if (!tool) return { ok: false, error: `网页上没有找到工具「${name}」` }

    let result: unknown
    try {
      result = await context.executeTool(tool, args ?? {})
    } catch (error) {
      // 早期版本的 executeTool 只接受 JSON 字符串参数
      if (!(error instanceof Error) || !error.message.startsWith('Failed to parse input')) {
        throw error
      }
      result = await context.executeTool(tool, JSON.stringify(args ?? {}))
    }
    return { ok: true, result: serializeResult(result) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 声明式（表单）工具提交后，结果页把结果写在 JSON-LD 里 */
function readDocumentResult(): string | null {
  return document.querySelector('script[type="application/ld+json"]')?.textContent ?? null
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_idle',
  main() {
    if (!hasExtensionRuntime()) return

    const context = getModelContext()
    const isTop = window === window.top
    let subscribed = false
    let timer: number | undefined

    const report = async () => {
      // 浏览器没开 WebMCP 时只由顶层 frame 上报一次，避免每个 iframe 重复报告
      if (!context && !isTop) return
      const tools = context ? (await getOwnTools(context)).map(serializeTool) : []
      const message: WebmcpFrameReport = {
        type: 'webmcp-tools',
        supported: Boolean(context),
        url: location.href,
        title: document.title,
        tools,
      }
      await browser.runtime.sendMessage(message).catch(() => undefined)
    }

    const scheduleReport = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void report().catch(() => undefined), REPORT_DEBOUNCE_MS)
    }

    /** 首次被侧边栏请求后才监听工具变化（单页应用可能随时注册 / 注销工具） */
    const subscribe = () => {
      if (subscribed || !context) return
      subscribed = true
      if (context.addEventListener) context.addEventListener('toolchange', scheduleReport)
      else context.ontoolchange = scheduleReport
    }

    browser.runtime.onMessage.addListener((message: TabMessage, _sender, sendResponse) => {
      switch (message?.type) {
        case 'webmcp-list':
          subscribe()
          scheduleReport()
          return undefined
        case 'webmcp-execute':
          if (!context) {
            sendResponse({ ok: false, error: '浏览器未开启 WebMCP' } satisfies WebmcpExecuteResult)
            return undefined
          }
          void executeTool(context, message.name, message.args).then(sendResponse)
          return true
        case 'webmcp-read-result':
          if (isTop) sendResponse(readDocumentResult())
          return undefined
        default:
          return undefined
      }
    })
  },
})
