import { useEffect, useState, type ReactNode } from 'react'

import { useActiveTabId, useWebmcpTools } from '@/features/assistant/webmcp-client'
import Button from '@/ui/Button'
import Switch from '@/ui/Switch'
import { unlockHosts } from '@/utils/settings'
import { formatShortcut } from '@/utils/shortcut'
import { useCommandShortcuts } from '@/utils/useCommandShortcuts'
import { getActiveHostname } from '@/utils/tabs'
import { useStorageItem } from '@/utils/useStorageItem'

function Row({ title, desc, children }: { title: string; desc: ReactNode; children: ReactNode }) {
  return (
    <div className='flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm'>
      <div className='flex min-w-0 flex-col'>
        <span className='text-sm font-medium text-slate-800'>{title}</span>
        <span className='truncate text-xs text-slate-400'>{desc}</span>
      </div>
      <div className='shrink-0'>{children}</div>
    </div>
  )
}

/**
 * 打开侧边栏的按钮（仅 Chrome 支持侧边栏）。
 * sidePanel.open 必须在点击的同步调用栈里执行，所以提前取好 windowId
 */
function OpenSidePanelButton() {
  const [windowId, setWindowId] = useState<number | null>(null)

  useEffect(() => {
    if (!chrome.sidePanel) return
    void browser.windows.getCurrent().then((win) => setWindowId(win.id ?? null))
  }, [])

  const open = () => {
    if (windowId != null) void chrome.sidePanel.open({ windowId }).then(() => window.close())
  }

  return (
    <Button
      variant='primary'
      onClick={open}
      disabled={windowId == null}
      className='!px-3 !py-1 text-xs'
    >
      打开
    </Button>
  )
}

function AssistantRow() {
  const shortcut = useCommandShortcuts()['open-assistant'] ?? ''

  return (
    <Row
      title='AI 助手'
      desc={`侧边栏里总结网页、就网页内容提问${shortcut ? ` · ${formatShortcut(shortcut)}` : ''}`}
    >
      <OpenSidePanelButton />
    </Row>
  )
}

/** 当前网页的 WebMCP 工具：显示数量，AI 助手里可以调用或手动执行 */
function WebmcpRow() {
  const tabId = useActiveTabId()
  const { tools, status } = useWebmcpTools(tabId)

  const desc =
    status === 'loading'
      ? '正在检测当前网页…'
      : status === 'unsupported'
        ? '浏览器未开启 WebMCP（chrome://flags 启用 WebMCP for testing）'
        : status === 'unavailable'
          ? '当前页面不支持'
          : tools.length
            ? `当前网页提供 ${tools.length} 个工具，可让 AI 调用或手动执行`
            : '当前网页没有提供工具'

  return (
    <Row title='网页工具（WebMCP）' desc={desc}>
      <OpenSidePanelButton />
    </Row>
  )
}

/** 解除复制限制：只对当前站点开关（全局阻断 copy 等事件会让在线编辑器失灵） */
function UnlockSiteRow() {
  const [hosts, setHosts] = useStorageItem(unlockHosts)
  const [hostname, setHostname] = useState('')

  useEffect(() => {
    void getActiveHostname().then(setHostname)
  }, [])

  const enabled = Boolean(hostname) && hosts.includes(hostname)
  const toggle = (checked: boolean) => {
    if (!hostname) return
    setHosts(checked ? [...new Set([...hosts, hostname])] : hosts.filter((h) => h !== hostname))
  }

  return (
    <Row
      title='解除本站复制限制'
      desc={
        hostname
          ? `${hostname}：放开复制、选择与右键${hosts.length > 1 ? `（共 ${hosts.length} 个站点已开启）` : ''}`
          : '当前页面不支持'
      }
    >
      <Switch checked={enabled} onChange={toggle} disabled={!hostname} />
    </Row>
  )
}

/** popup「功能」页：侧边栏入口与针对当前网站的开关，全局设置在设置页 */
export default function FunctionPage() {
  const openEnhanceSettings = () => {
    void browser.tabs
      .create({ url: browser.runtime.getURL('/options.html#enhance') })
      .finally(() => window.close())
  }

  return (
    <div className='flex flex-col gap-2.5'>
      {chrome.sidePanel && (
        <>
          <AssistantRow />
          <WebmcpRow />
        </>
      )}
      <UnlockSiteRow />
      <button
        type='button'
        onClick={openEnhanceSettings}
        className='self-end text-xs text-slate-400 transition-colors hover:text-indigo-600'
      >
        管理全部网站与更多功能 ↗
      </button>
    </div>
  )
}
