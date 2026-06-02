/**
 * 站点图标：多 favicon 源顺序兜底，最后显示标题首字符。
 */

import { useEffect, useMemo, useState } from 'react'

import { faviconUrls } from './engines'

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
  const sources = useMemo(() => faviconUrls(url, size), [url, size])
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setIndex(0)
    setFailed(false)
  }, [sources])

  const fallbackClassName = `${className} flex items-center justify-center bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300`

  if (failed || sources.length === 0) {
    return (
      <span aria-hidden='true' className={fallbackClassName}>
        {fallbackText(title)}
      </span>
    )
  }

  return (
    <img
      src={sources[index]}
      alt=''
      className={className}
      onError={() => {
        if (index < sources.length - 1) {
          setIndex(index + 1)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}
