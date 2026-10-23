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
import type { DictResult } from '@/types/dict'
import type { NetworkMode, PopupShortcutTab, TranslateProvider } from '@/utils/settings'

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
  /** 测试句的译文 */
  sample?: string
  /** 失败原因：code 用于界面给出友好提示，message 为原始信息（仅供排查） */
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
  | { type: 'open-options-page' }
  | { type: 'sync-cors-bypass' }
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
  'open-options-page': { ok: boolean }
  'sync-cors-bypass': boolean
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

/** 内容脚本对 TabMessage 的响应（无响应的消息不在此列） */
export interface TabResponseMap {
  'translate-page': PageTranslationState
  'set-page-translation': PageTranslationState
  'get-page-translation-state': PageTranslationState
  'collect-media-resources': MediaResourceCandidate[]
}

/** 向 Background 发送请求并返回类型化结果 */
export async function sendRuntimeMessage<T extends RuntimeMessage['type']>(
  message: Extract<RuntimeMessage, { type: T }>,
): Promise<RuntimeResponseMap[T]> {
  return browser.runtime.sendMessage(message)
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
