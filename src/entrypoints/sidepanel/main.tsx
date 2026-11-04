import '@/assets/global.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import AssistantApp from '@/features/assistant/AssistantApp'
import { OPEN_ASSISTANT_COMMAND } from '@/utils/shortcut'
import { initDocumentTheme } from '@/utils/theme'

document.documentElement.classList.add('sidepanel-page')

// 快捷键切换：侧边栏开着时也会收到「打开 AI 助手」命令，是本窗口触发的就关掉自己。
// 由侧边栏页自己判断开关状态，后台不用记（Service Worker 回收后内存状态会丢）。
// Firefox 由后台调用 sidebarAction.toggle()，这里不处理。
if (!import.meta.env.FIREFOX) {
  const windowIdReady = browser.windows.getCurrent().then((win) => win.id)
  browser.commands?.onCommand.addListener((command, tab) => {
    if (command !== OPEN_ASSISTANT_COMMAND) return
    void windowIdReady.then((windowId) => {
      if (windowId != null && tab?.windowId === windowId) window.close()
    })
  })
}

void initDocumentTheme()
  .catch(() => undefined)
  .finally(() =>
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <AssistantApp />
      </React.StrictMode>,
    ),
  )
