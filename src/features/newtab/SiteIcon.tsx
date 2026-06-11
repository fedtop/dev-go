/**
 * 站点图标：本地持久化缓存优先（见 faviconCache.ts），未命中按多 favicon 源抓取，
 * 拿不到时显示标题首字符。
 */

import { useEffect, useState } from 'react'

import { loadFavicon } from './faviconCache'

interface SiteIconProps {
  url: string
  title: string
  size?: number
  className?: string
}

function fallbackText(title: string): string {
  return title.trim().charAt(0).toUpperCase() || '?'
}

export default function SiteIcon({ url, title, size = 64, className = '' }: SiteIconProps) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setSrc('')
    setFailed(false)
    // 第三个参数：后台抓到更清晰的图标时推送替换（抓不到则保留首个结果）
    loadFavicon(url, size, (better) => {
      if (alive) setSrc(better)
    })
      .then((dataUrl) => {
        if (!alive) return
        if (dataUrl) setSrc(dataUrl)
        else setFailed(true)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [url, size])

  if (failed || !src) {
    return (
      <span
        aria-hidden='true'
        className={`${className} flex items-center justify-center bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300`}
      >
        {fallbackText(title)}
      </span>
    )
  }

  return <img src={src} alt='' className={className} onError={() => setFailed(true)} />
}
