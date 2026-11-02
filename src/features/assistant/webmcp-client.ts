/**
 * 侧边栏侧的 WebMCP 客户端：汇总各 frame 上报的工具，并在指定 frame 执行。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  isWebmcpFrameReport,
  type TabMessage,
  type WebmcpExecuteResult,
  type WebmcpTool,
} from '@/utils/messaging'

/** 某个 frame 中的工具（frameId 用于把执行请求发回正确的 frame） */
export interface FrameTool extends WebmcpTool {
  frameId: number
}

export type ToolsStatus =
  /** 等待内容脚本回报 */
  | 'loading'
  | 'ready'
  /** 浏览器没开 WebMCP */
  | 'unsupported'
  /** 页面不能注入内容脚本（chrome:// 页面、商店页、刚安装扩展前已打开的页面等） */
  | 'unavailable'

export interface PageInfo {
  url: string
  title: string
}

/** 内容脚本注入后会在这个时间内回报；超时仍没有任何回报视为页面不可用 */
const REPORT_TIMEOUT_MS = 1500
const NAVIGATION_WAIT_MS = 8000

function sendTabMessage<T>(tabId: number, message: TabMessage, frameId?: number): Promise<T> {
  return browser.tabs.sendMessage(
    tabId,
    message,
    frameId == null ? undefined : { frameId },
  ) as Promise<T>
}

/** 等待标签页加载完成（超时也返回，不让对话卡住） */
function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer)
      browser.tabs.onUpdated.removeListener(listener)
      resolve()
    }
    const listener = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') done()
    }
    const timer = window.setTimeout(done, NAVIGATION_WAIT_MS)
    browser.tabs.onUpdated.addListener(listener)
  })
}

/**
 * 在指定 frame 执行工具。工具若触发页面跳转（如提交表单），消息通道会随旧文档一起关闭：
 * 此时等新页面加载完，再读取结果页里的 JSON-LD 作为结果。
 */
export async function executeFrameTool(
  tabId: number,
  frameId: number,
  name: string,
  args: unknown,
): Promise<WebmcpExecuteResult> {
  try {
    const result = await sendTabMessage<WebmcpExecuteResult | undefined>(
      tabId,
      { type: 'webmcp-execute', name, args },
      frameId,
    )
    return result ?? { ok: false, error: '网页没有响应，请刷新页面后重试' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/message channel (is )?closed|message port closed/i.test(message)) {
      return {
        ok: false,
        error: /Receiving end does not exist/i.test(message)
          ? '网页上的 DevGo 脚本未就绪，请刷新页面后重试'
          : message,
      }
    }
  }

  await waitForTabComplete(tabId)
  const documentResult = await sendTabMessage<string | null>(
    tabId,
    { type: 'webmcp-read-result' },
    0,
  ).catch(() => null)
  return {
    ok: true,
    result: documentResult ?? '工具已执行，页面发生了跳转，未在新页面中找到返回结果',
  }
}

/**
 * 跟踪指定标签页的 WebMCP 工具：切换标签页、页面跳转、网页增删工具时自动刷新。
 */
export function useWebmcpTools(tabId: number | null) {
  const [frames, setFrames] = useState<Map<number, FrameTool[]>>(new Map())
  const [status, setStatus] = useState<ToolsStatus>('loading')
  const [page, setPage] = useState<PageInfo>({ url: '', title: '' })
  const timeoutRef = useRef<number>()

  const refresh = useCallback(() => {
    if (tabId == null) return
    setFrames(new Map())
    setStatus('loading')
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'unavailable' : current))
    }, REPORT_TIMEOUT_MS)

    sendTabMessage(tabId, { type: 'webmcp-list' }).catch(() => {
      window.clearTimeout(timeoutRef.current)
      setStatus('unavailable')
    })
  }, [tabId])

  useEffect(() => {
    if (tabId == null) return undefined
    refresh()

    const onMessage = (message: unknown, sender: Browser.runtime.MessageSender) => {
      if (!isWebmcpFrameReport(message) || sender.tab?.id !== tabId) return
      const frameId = sender.frameId ?? 0
      window.clearTimeout(timeoutRef.current)

      if (!message.supported) {
        setStatus('unsupported')
        return
      }
      if (frameId === 0) setPage({ url: message.url, title: message.title })
      setStatus('ready')
      setFrames((current) => {
        const next = new Map(current)
        next.set(
          frameId,
          message.tools.map((tool) => ({ ...tool, frameId })),
        )
        return next
      })
    }

    const onUpdated = (id: number, info: { status?: string; url?: string; title?: string }) => {
      if (id !== tabId) return
      if (info.url || info.title) {
        setPage((current) => ({
          url: info.url ?? current.url,
          title: info.title ?? current.title,
        }))
      }
      // 页面（重新）加载完成后内容脚本是新的实例，需要重新请求
      if (info.status === 'complete') refresh()
    }

    browser.runtime.onMessage.addListener(onMessage)
    browser.tabs.onUpdated.addListener(onUpdated)
    void browser.tabs.get(tabId).then(
      (tab) => setPage({ url: tab.url ?? '', title: tab.title ?? '' }),
      () => undefined,
    )

    return () => {
      window.clearTimeout(timeoutRef.current)
      browser.runtime.onMessage.removeListener(onMessage)
      browser.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [tabId, refresh])

  const tools = [...frames.entries()].sort(([a], [b]) => a - b).flatMap(([, list]) => list)

  return { tools, status, page, refresh }
}

/** 侧边栏所在窗口的当前标签页 id（跟随切换） */
export function useActiveTabId(): number | null {
  const [tabId, setTabId] = useState<number | null>(null)

  useEffect(() => {
    let windowId: number | undefined
    const sync = async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      windowId = tab?.windowId
      setTabId(tab?.id ?? null)
    }
    void sync()

    const onActivated = (info: { tabId: number; windowId: number }) => {
      if (windowId == null || info.windowId === windowId) setTabId(info.tabId)
    }
    browser.tabs.onActivated.addListener(onActivated)
    return () => browser.tabs.onActivated.removeListener(onActivated)
  }, [])

  return tabId
}
