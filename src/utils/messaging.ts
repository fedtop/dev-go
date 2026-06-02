/**
 * 扩展内统一的消息协议与类型安全的收发封装。
 *
 * 消息分两类：
 * - Runtime 消息：内容脚本 / Popup ↔ Background（请求翻译、查词典、测试连通性）
 * - Tab 消息：Background / Popup → 指定标签页的内容脚本（触发整页翻译、提示）
 */

import type { DictResult } from '@/types/dict'

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

/** Background 负责响应的请求消息（runtime 通道） */
export type RuntimeMessage =
  | { type: 'translate'; text: string; html?: boolean }
  | { type: 'lookup'; word: string }
  | { type: 'test' }
  | { type: 'sync-cors-bypass' }
  | { type: 'cors-proxy-fetch'; request: CorsProxyRequest }

/** Background 对 RuntimeMessage 的响应 */
export interface RuntimeResponseMap {
  translate: { text: string }
  lookup: DictResult | null
  test: boolean
  'sync-cors-bypass': boolean
  'cors-proxy-fetch': CorsProxyResponse
}

/** 发给内容脚本的指令消息（tab 通道） */
export type TabMessage = { type: 'translate-page' } | { type: 'tip'; msg: string }

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
