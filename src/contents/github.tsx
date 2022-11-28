import type { PlasmoContentScript } from 'plasmo'
import { useEffect, useState } from 'react'

export const config: PlasmoContentScript = {
  matches: ['https://github.com/*/*'],
}

// 判断当前页是否为 github code page
function watchPage() {
  // 获取当前页面的 url
  const url = window.location.href
  return (
    document.querySelectorAll('.file-navigation').length > 0 ||
    url.includes('/blob/') ||
    url.includes('/tree/')
  )
}
// 打开 github1s
function github1s() {
  window.open(`${`https://github1s.com${window.location.pathname}`}`)
}

// 监听tab页面加载状态，添加处理事件
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   // 设置判断条件，页面加载完成才添加事件，否则会导致事件重复添加触发多次
//   if (changeInfo.status === 'complete') {
//     console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 / onUpdated', changeInfo)
//   }
// })

export default function FunctionPage() {
  const [isCodePage, setIsCodePage] = useState(false)

  useEffect(() => {
    setIsCodePage(watchPage())
  }, [])
  return (
    <>
      {isCodePage && (
        <button
          onClick={github1s}
          style={{
            color: 'white',
            colorScheme: 'dark',
            fontWeight: 'bold',
            padding: '5px 10px',
            lineHeight: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            background: 'rgb(52, 125, 57)',
            position: 'fixed',
            right: '100px',
            bottom: '100px',
            border: '1px solid rgba(205, 217, 229, 0.1)',
            borderRadius: '6px',
          }}
        >
          在线编辑
        </button>
      )}
    </>
  )
}

// window.addEventListener('load', () => {
//   document.body.style.background = 'pink'
// })
