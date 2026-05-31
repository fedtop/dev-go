import { throttle } from 'lodash-es'
import { useEffect, useState } from 'react'

/** 监听滚动，返回是否在顶部以及回到顶部的方法 */
export function useScrollToTop(): [boolean, () => void] {
  const [isTop, setIsTop] = useState(true)

  const scrollToTop = () => {
    try {
      window.scroll({ top: 0, left: 0, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, 0)
    }
  }

  useEffect(() => {
    const handleScroll = throttle(() => {
      setIsTop(window.scrollY <= 0)
    }, 100)

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      handleScroll.cancel()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return [isTop, scrollToTop]
}
