import { useEffect, useState } from 'react'

import FloatButton from './components/FloatButton'
import { ArrowUpward, EditIcon, WikiIcon } from './components/icons'
import { useScrollToTop } from './useScrollToTop'
import { isGithubCodePage, openInDeepWiki, openInGithub1s } from './utils'

export default function GithubApp() {
  const [isCodePage, setIsCodePage] = useState(() => isGithubCodePage())
  const [isTop, scrollToTop] = useScrollToTop()

  useEffect(() => {
    // 快捷键 "," 直接在 github1s 中打开
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // 避免在输入框中误触发
      const isEditable =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (e.code === 'Comma' && !isEditable) {
        openInGithub1s()
      }
    }

    // GitHub 是 SPA，路由变化时重新判断是否为代码页
    const onLocationChange = () => setIsCodePage(isGithubCodePage())

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('popstate', onLocationChange)
    document.addEventListener('pjax:end', onLocationChange)
    document.addEventListener('turbo:render', onLocationChange)
    document.addEventListener('turbo:load', onLocationChange)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('popstate', onLocationChange)
      document.removeEventListener('pjax:end', onLocationChange)
      document.removeEventListener('turbo:render', onLocationChange)
      document.removeEventListener('turbo:load', onLocationChange)
    }
  }, [])

  if (!isCodePage) return null

  return (
    <div
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
      }}
    >
      <FloatButton icon={<EditIcon />} title='在线编辑' onClick={openInGithub1s} />
      <FloatButton icon={<WikiIcon />} title='DeepWiki' onClick={openInDeepWiki} />
      {!isTop && (
        <FloatButton icon={<ArrowUpward />} title='回到顶部' iconOnly onClick={scrollToTop} />
      )}
    </div>
  )
}
