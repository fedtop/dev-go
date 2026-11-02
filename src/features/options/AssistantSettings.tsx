import { useEffect, useState } from 'react'

import Button from '@/ui/Button'
import Switch from '@/ui/Switch'
import { assistantConfirmTools } from '@/utils/settings'
import { useStorageItem } from '@/utils/useStorageItem'

import { Card, Row, SectionHeader } from './layout'

/** 设置页：侧边栏 AI 助手 */
export default function AssistantSettings() {
  const [confirmTools, setConfirmTools] = useStorageItem(assistantConfirmTools)
  const [windowId, setWindowId] = useState<number | null>(null)
  const [shortcut, setShortcut] = useState('')

  useEffect(() => {
    if (chrome.sidePanel) {
      void browser.windows.getCurrent().then((win) => setWindowId(win.id ?? null))
    }
    void browser.commands
      ?.getAll()
      .then((commands) =>
        setShortcut(commands.find((command) => command.name === 'open-assistant')?.shortcut ?? ''),
      )
  }, [])

  // sidePanel.open 必须在点击的同步调用栈里执行，所以提前取好 windowId
  const open = () => {
    if (windowId != null) void chrome.sidePanel.open({ windowId })
  }

  return (
    <div className='flex flex-col gap-5'>
      <SectionHeader title='AI 助手' desc='浏览器侧边栏里的 AI 助手，使用「AI 模型」里的对话模型' />

      <Card
        title='侧边栏助手'
        desc='总结网页、提取要点、就网页内容提问（包括 Shadow DOM 渲染的页面）；划词「问 AI」会带着选中内容打开这里。'
      >
        <Row
          label='打开侧边栏'
          hint={
            shortcut
              ? `快捷键 ${shortcut}，也可以在弹窗「功能」页打开`
              : '可在 chrome://extensions/shortcuts 设置快捷键'
          }
        >
          <Button onClick={open} disabled={windowId == null} className='!px-3 !py-1.5 text-sm'>
            打开
          </Button>
        </Row>
      </Card>

      <Card
        title='网页工具（WebMCP）'
        desc={
          <>
            网页可以通过 WebMCP 向 AI
            提供可执行的工具（查询、下单、填写表单等），助手会自动发现并调用。 需要 Chrome 150
            及以上，并在 chrome://flags 启用「WebMCP for testing」。
          </>
        }
      >
        <Row label='执行前确认' hint='未声明为只读的网页工具（可能修改数据），执行前先让你确认'>
          <Switch checked={confirmTools} onChange={setConfirmTools} />
        </Row>
      </Card>
    </div>
  )
}
