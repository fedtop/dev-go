/**
 * 扩展内统一的消息协议与类型安全的收发封装。
 *
 * 消息分三类：
 * - Runtime 消息：内容脚本 / Popup ↔ Background（划词翻译、查词典、测试连通性）
 * - Tab 消息：Background / Popup → 指定标签页的内容脚本（整页翻译开关、提示）
 * - 翻译端口：内容脚本 ↔ Background 的长连接，整页翻译按段流式回传（见 TranslatePort*）
 */

import type { TranslateErrorPayload } from '@/features/translate/errors'
import type { TranslateLangCode } from '@/features/translate/languages'
import type { LlmConfig } from '@/features/translate/llm-config'
import type { SelectionAiAction, SelectionContext } from '@/features/ai/actions'
import type { DictResult } from '@/types/dict'
import type { WordResult } from '@/types/word'
import type { NetworkMode, PopupShortcutTab, SyncStatus, TranslateProvider } from '@/utils/settings'

export interface CorsProxyRequest {
  url: string
  method: string
  headers: [string, string][]
  body?: string
  credentials?: RequestCredentials
  redirect?: RequestRedirect
}

export interface CorsProxyResponse {
  url: string
  status: number
  statusText: string
  headers: [string, string][]
  body: string
  redirected: boolean
  error?: string
}

export interface NetworkProxyStatus {
  ok: boolean
  mode: NetworkMode
  managed: boolean
  levelOfControl?: chrome.types.ChromeSettingGetResultDetails['levelOfControl']
  error?: string
}

export interface NetworkRuleListDownloadStatus {
  ok: boolean
  url: string
  lastUpdate?: string
  proxyRuleCount?: number
  directRuleCount?: number
  error?: string
}

/* ------------------------------- 媒体资源嗅探 ------------------------------- */

export type MediaResourceKind = 'image' | 'video'

export type MediaResourceSource = 'network' | 'dom' | 'network+dom'

export interface MediaResourceCandidate {
  url: string
  kind: MediaResourceKind
  source: 'network' | 'dom'
  pageUrl?: string
  mime?: string
  extension?: string
  fileName?: string
  thumbnailUrl?: string
  size?: number
  width?: number
  height?: number
  firstSeen?: number
  lastSeen?: number
}

export interface MediaResource extends Required<Pick<MediaResourceCandidate, 'url' | 'kind'>> {
  id: string
  tabId: number
  source: MediaResourceSource
  pageUrl?: string
  mime?: string
  extension?: string
  fileName: string
  thumbnailUrl?: string
  size?: number
  width?: number
  height?: number
  firstSeen: number
  lastSeen: number
}

export interface MediaResourceListResult {
  tabId?: number
  pageUrl?: string
  resources: MediaResource[]
  error?: string
}

export interface MediaDownloadResult {
  ok: boolean
  downloadId?: number
  error?: string
}

/** Background -> Popup：快捷键请求切换或关闭 popup 面板 */
export interface PopupShortcutMessage {
  type: 'popup-shortcut'
  tab: PopupShortcutTab
  nonce: number
}

export interface PopupShortcutResponse {
  handled: true
}

/* -------------------------------- 翻译 -------------------------------- */

/** 划词 / 单段翻译结果 */
export interface TranslateTextResult {
  text: string
  error?: TranslateErrorPayload
}

/** 测试翻译引擎；可传入尚未保存的配置（选项页「测试连接」） */
export interface TranslateTestRequest {
  provider?: TranslateProvider
  llm?: LlmConfig
  apiKey?: string
}

export interface TranslateTestResult {
  ok: boolean
  /** 连通但有隐患（如助手模型未调用工具），界面以警告色展示 sample */
  warning?: boolean
  /** 测试句的译文 */
  sample?: string
  /** 失败原因：code 用于界面给出友好提示，message 为原始信息（仅供排查） */
  error?: TranslateErrorPayload
}

/** AI 查词结果：失败时 result 为 null，error 给出原因 */
export interface AiLookupResult {
  result: WordResult | null
  error?: TranslateErrorPayload
}

export interface LlmModelListResult {
  models: string[]
  /** 失败原因：code 用于界面给出友好提示，message 为原始信息（仅供排查） */
  error?: { code: TranslateErrorPayload['code'] | 'timeout'; message: string }
}

/** 内容脚本 ↔ Background 整页翻译长连接的端口名 */
export const TRANSLATE_PORT_NAME = 'devgo-translate'

/** 待翻译段落：text 为「纯文本 + <bN> 行内标记」格式（见 features/translate/page/codec.ts） */
export interface TranslateSegment {
  id: string
  text: string
}

/** 页面上下文：帮助大模型理解术语与语境 */
export interface TranslatePageContext {
  title?: string
  host?: string
}

/** 内容脚本 → Background */
export type TranslatePortRequest =
  | {
      type: 'translate'
      requestId: string
      target: TranslateLangCode
      segments: TranslateSegment[]
      context?: TranslatePageContext
    }
  | { type: 'cancel'; requestId: string }

/** Background → 内容脚本：每段完成即推送，整批结束后发送 done */
export type TranslatePortEvent =
  | { type: 'segment'; requestId: string; id: string; text: string }
  | { type: 'segment-error'; requestId: string; id: string; error: TranslateErrorPayload }
  | { type: 'done'; requestId: string }
  | { type: 'error'; requestId: string; error: TranslateErrorPayload }

/* -------------------------------- 划词 AI -------------------------------- */

/** 内容脚本 ↔ Background 划词 AI 动作长连接的端口名（一次动作一条连接，断开即取消） */
export const SELECTION_AI_PORT_NAME = 'devgo-selection-ai'

/** 内容脚本 → Background：执行一个划词 AI 动作 */
export interface SelectionAiRequest {
  type: 'run'
  action: SelectionAiAction
  text: string
  context: SelectionContext
}

/** Background → 内容脚本：流式结果 */
export type SelectionAiEvent =
  | { type: 'reasoning'; delta: string }
  | { type: 'text'; delta: string }
  | { type: 'done' }
  | { type: 'error'; error: TranslateErrorPayload }

/**
 * 内容脚本 → Background：打开侧边栏助手（划词「问 AI」）。
 * sidePanel.open 必须在用户手势的同步调用栈里执行，因此不走异步的消息路由，由后台单独的同步监听处理。
 */
export interface OpenAssistantMessage {
  type: 'open-assistant'
  handoff: AssistantHandoff
}

export function isOpenAssistantMessage(value: unknown): value is OpenAssistantMessage {
  return (
    typeof value === 'object' &&
    value != null &&
    (value as OpenAssistantMessage).type === 'open-assistant'
  )
}

/** WebRTC 防泄露状态 */
export interface WebrtcStatus {
  /** 浏览器支持 privacy.network.webRTCIPHandlingPolicy */
  supported: boolean
  /** 已授予可选权限 privacy */
  permission: boolean
  /** 浏览器当前生效的策略；未授权时为 null */
  value: string | null
  /**
   * 设置的控制状态：controlled_by_this_extension / controllable_by_this_extension /
   * controlled_by_other_extensions（被 WebRTC Control 等扩展接管）/ not_controllable
   */
  control: string | null
}

export interface WebrtcCandidate {
  /** host（本机网卡）/ srflx（经 STUN 得到的公网地址）/ relay（中继） */
  type: string
  address: string
  protocol: string
}

export interface WebrtcLeakResult {
  /** 实际执行检测的网页 */
  host?: string
  candidates: WebrtcCandidate[]
  /** 网页里 RTCPeerConnection 已被屏蔽 */
  blocked?: boolean
  error?: string
}

/** 交给侧边栏助手继续处理的内容（划词「问 AI」/「继续追问」） */
export interface AssistantHandoff {
  /** 每次交接唯一，侧边栏据此去重 */
  id: string
  /** 引用的选中文字 */
  quote: string
  url: string
  title: string
  /** 已有的一轮问答（在气泡里解释 / 总结后继续追问） */
  exchange?: { question: string; answer: string }
}

/** 当前标签页的整页翻译状态 */
export interface PageTranslationState {
  active: boolean
}

/** Background 负责响应的请求消息（runtime 通道） */
export type RuntimeMessage =
  | { type: 'translate'; text: string }
  | { type: 'lookup'; word: string }
  | ({ type: 'test-translate' } & TranslateTestRequest)
  | { type: 'list-llm-models'; baseUrl: string; apiKey: string }
  /** popup 查词框：用翻译模型查词 / 翻译短句 */
  | { type: 'ai-lookup'; text: string }
  /** 测试对话模型配置（连通性 + 是否支持工具调用） */
  | { type: 'test-assistant'; llm: LlmConfig; apiKey: string }
  /** 立即执行一次跨设备同步对账 */
  | { type: 'sync-now' }
  | { type: 'open-options-page' }
  | { type: 'sync-cors-bypass' }
  /** WebRTC 防泄露的生效状态（权限、浏览器当前策略、是否被其他扩展接管） */
  | { type: 'get-webrtc-status' }
  /** 在最近使用的网页标签里实测 WebRTC 会暴露哪些地址（扩展页面不受策略约束，不能在设置页里测） */
  | { type: 'test-webrtc-leak' }
  | { type: 'cors-proxy-fetch'; request: CorsProxyRequest }
  | { type: 'apply-network-mode'; mode: NetworkMode }
  | { type: 'sync-network-proxy' }
  | { type: 'get-network-status' }
  | { type: 'download-network-rule-list'; url: string }
  | { type: 'get-media-resources'; tabId?: number; includeDom?: boolean }
  | { type: 'clear-media-resources'; tabId?: number }
  | {
      type: 'download-media-resource'
      url: string
      fileName?: string
      mime?: string
      saveAs?: boolean
    }

/** Background 对 RuntimeMessage 的响应 */
export interface RuntimeResponseMap {
  translate: TranslateTextResult
  lookup: DictResult | null
  'test-translate': TranslateTestResult
  'list-llm-models': LlmModelListResult
  'ai-lookup': AiLookupResult
  'test-assistant': TranslateTestResult
  'sync-now': SyncStatus
  'open-options-page': { ok: boolean }
  'sync-cors-bypass': boolean
  'get-webrtc-status': WebrtcStatus
  'test-webrtc-leak': WebrtcLeakResult
  'cors-proxy-fetch': CorsProxyResponse
  'apply-network-mode': NetworkProxyStatus
  'sync-network-proxy': NetworkProxyStatus
  'get-network-status': NetworkProxyStatus
  'download-network-rule-list': NetworkRuleListDownloadStatus
  'get-media-resources': MediaResourceListResult
  'clear-media-resources': { ok: boolean; removed: number }
  'download-media-resource': MediaDownloadResult
}

/** 发给内容脚本的指令消息（tab 通道） */
export type TabMessage =
  /** 切换整页翻译（已翻译则恢复原文） */
  | { type: 'translate-page' }
  | { type: 'set-page-translation'; enabled: boolean }
  | { type: 'get-page-translation-state' }
  | { type: 'tip'; msg: string }
  | { type: 'collect-media-resources' }
  /** 请求各 frame 上报 WebMCP 工具（不指定 frameId 时广播到所有 frame，结果以 WebmcpFrameReport 回传） */
  | { type: 'webmcp-list' }
  /** 在指定 frame 执行 WebMCP 工具 */
  | { type: 'webmcp-execute'; name: string; args: unknown }
  /** 读取跨文档工具（表单提交跳转后）写在结果页 JSON-LD 里的结果 */
  | { type: 'webmcp-read-result' }
  /** 读取网页正文（侧边栏助手总结 / 问答用，只由顶层 frame 响应） */
  | { type: 'read-page'; maxChars?: number }

/** 内容脚本对 TabMessage 的响应（无响应的消息不在此列） */
export interface TabResponseMap {
  'translate-page': PageTranslationState
  'set-page-translation': PageTranslationState
  'get-page-translation-state': PageTranslationState
  'collect-media-resources': MediaResourceCandidate[]
  'webmcp-execute': WebmcpExecuteResult
  'webmcp-read-result': string | null
  'read-page': PageContent
}

/** 网页正文快照 */
export interface PageContent {
  url: string
  title: string
  /** 正文（Markdown 风格的纯文本：标题、列表、段落） */
  text: string
  /** 当前选中的文字 */
  selection: string
  /** 正文超出上限被截断 */
  truncated: boolean
}

/* -------------------------------- WebMCP -------------------------------- */

/** 网页通过 WebMCP 注册的工具（已序列化，可跨上下文传递） */
export interface WebmcpTool {
  name: string
  description: string
  /** 参数 JSON Schema；网页未声明时为 null */
  inputSchema: unknown
  /** 网页声明为只读（readOnlyHint）的工具执行前无需确认 */
  readOnly: boolean
  /** 网页声明的其他注解名（展示用） */
  annotations: string[]
}

/** 内容脚本 → 扩展页面：某个 frame 当前的工具列表（frameId 取自 sender） */
export interface WebmcpFrameReport {
  type: 'webmcp-tools'
  /** 浏览器是否开启了 WebMCP（chrome://flags 的「WebMCP for testing」） */
  supported: boolean
  url: string
  title: string
  tools: WebmcpTool[]
}

export function isWebmcpFrameReport(value: unknown): value is WebmcpFrameReport {
  return (
    typeof value === 'object' &&
    value != null &&
    (value as WebmcpFrameReport).type === 'webmcp-tools' &&
    Array.isArray((value as WebmcpFrameReport).tools)
  )
}

export interface WebmcpExecuteResult {
  ok: boolean
  /** 工具返回值（非字符串已 JSON 序列化）；null 表示没有返回值，可能触发了页面跳转 */
  result?: string | null
  error?: string
}

/** Background 处理消息时抛错的统一响应；sendRuntimeMessage 收到后还原为异常抛给调用方 */
export interface RuntimeErrorResponse {
  devgoError: string
}

export function isRuntimeErrorResponse(value: unknown): value is RuntimeErrorResponse {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof (value as RuntimeErrorResponse).devgoError === 'string'
  )
}

/** 向 Background 发送请求并返回类型化结果；后台处理失败时 reject，而不是一直等待 */
export async function sendRuntimeMessage<T extends RuntimeMessage['type']>(
  message: Extract<RuntimeMessage, { type: T }>,
): Promise<RuntimeResponseMap[T]> {
  const response: unknown = await browser.runtime.sendMessage(message)
  if (isRuntimeErrorResponse(response)) throw new Error(response.devgoError)
  return response as RuntimeResponseMap[T]
}

/** 向当前激活标签页发送指令 */
export async function sendTabMessage(message: TabMessage): Promise<void> {
  await sendTabRequest(message)
}

/**
 * 向当前激活标签页发送请求并返回类型化响应。
 * 标签页没有注入内容脚本（如 chrome:// 页面、扩展商店）时返回 null。
 */
export async function sendTabRequest<T extends TabMessage['type']>(
  message: Extract<TabMessage, { type: T }>,
): Promise<T extends keyof TabResponseMap ? TabResponseMap[T] | null : null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (tab?.id == null) return null as never
  try {
    return ((await browser.tabs.sendMessage(tab.id, message)) ?? null) as never
  } catch (error) {
    // 标签页没有注入内容脚本时会抛错，忽略即可
    console.warn('[DevGo] sendTabMessage failed:', error)
    return null as never
  }
}
