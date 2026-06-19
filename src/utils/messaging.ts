/**
 * 扩展内统一的消息协议与类型安全的收发封装。
 *
 * 消息分两类：
 * - Runtime 消息：内容脚本 / Popup ↔ Background（请求翻译、查词典、测试连通性）
 * - Tab 消息：Background / Popup → 指定标签页的内容脚本（触发整页翻译、提示）
 */

import type { DictResult } from '@/types/dict'
import type { NetworkMode, PopupShortcutTab } from '@/utils/settings'

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

/** Background 负责响应的请求消息（runtime 通道） */
export type RuntimeMessage =
  | { type: 'translate'; text: string; html?: boolean }
  | { type: 'translate-batch'; texts: string[]; html?: boolean }
  | { type: 'lookup'; word: string }
  | { type: 'test' }
  | { type: 'sync-cors-bypass' }
  | { type: 'cors-proxy-fetch'; request: CorsProxyRequest }
  | { type: 'apply-network-mode'; mode: NetworkMode }
  | { type: 'sync-network-proxy' }
  | { type: 'get-network-status' }
  | { type: 'download-network-rule-list'; url: string }
  | { type: 'get-media-resources'; tabId?: number; includeDom?: boolean }
  | { type: 'clear-media-resources'; tabId?: number }
  | { type: 'download-media-resource'; url: string; fileName?: string; saveAs?: boolean }

/** Background 对 RuntimeMessage 的响应 */
export interface RuntimeResponseMap {
  translate: { text: string }
  'translate-batch': { texts: string[] }
  lookup: DictResult | null
  test: boolean
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
  | { type: 'translate-page' }
  | { type: 'tip'; msg: string }
  | { type: 'collect-media-resources' }

/** 向 Background 发送请求并返回类型化结果 */
export async function sendRuntimeMessage<T extends RuntimeMessage['type']>(
  message: Extract<RuntimeMessage, { type: T }>,
): Promise<RuntimeResponseMap[T]> {
  return browser.runtime.sendMessage(message)
}

/** 向当前激活标签页发送指令 */
export async function sendTabMessage(message: TabMessage): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (tab?.id == null) return
  try {
    await browser.tabs.sendMessage(tab.id, message)
  } catch (error) {
    // 标签页没有注入内容脚本（如 chrome:// 页面）时会抛错，忽略即可
    console.warn('[DevGo] sendTabMessage failed:', error)
  }
}
