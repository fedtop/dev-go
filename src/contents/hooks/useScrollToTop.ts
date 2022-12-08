import { useState, useEffect } from 'react'
import { throttle } from 'lodash'

const useScrollToTop = (): [boolean, () => void] => {
  const [isTop, setTop] = useState(true)

  const scrollToTop = () => {
    try {
      setTimeout(() => {
        window.scroll({
          top: 0,
          left: 0,
          behavior: 'smooth',
        })
      }, 0)
    } catch (error) {
      window.scrollTo(0, 0)
    }
  }

  useEffect(() => {
    const handleScroll = throttle(() => {
      setTop(!(window.scrollY > 0))
    }, 100)

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return [isTop, scrollToTop]
}

export default useScrollToTop
