/**
 * 主题工具：在 <html> 上切换 `dark` class，供 Tailwind 暗色变体使用。
 * 三态：auto（按本地时间）/ light / dark。
 */

import type { StoredThemeMode, ThemeMode } from '@/utils/settings'

const AUTO_DARK_START_HOUR = 18
const AUTO_DARK_END_HOUR = 6

/** 兼容旧版存储中的 system 值。 */
export function normalizeThemeMode(mode: StoredThemeMode): ThemeMode {
  if (mode === 'dark' || mode === 'light') return mode
  return 'auto'
}

/** 自动模式：本地时间 18:00-06:00 使用深色。 */
export function isAutoDark(now = new Date()): boolean {
  const hour = now.getHours()
  return hour >= AUTO_DARK_START_HOUR || hour < AUTO_DARK_END_HOUR
}

/** 给定模式下最终是否应为暗色 */
export function isDark(mode: StoredThemeMode): boolean {
  const normalized = normalizeThemeMode(mode)
  if (normalized === 'auto') return isAutoDark()
  return normalized === 'dark'
}

/** 把主题应用到 <html>（增删 dark class），并返回最终是否为暗色 */
export function applyTheme(mode: StoredThemeMode): boolean {
  const dark = isDark(mode)
  document.documentElement.classList.toggle('dark', dark)
  return dark
}

function getNextAutoBoundaryDelay(now = new Date()): number {
  const next = new Date(now)
  const hour = now.getHours()

  if (hour < AUTO_DARK_END_HOUR) {
    next.setHours(AUTO_DARK_END_HOUR, 0, 0, 0)
  } else if (hour < AUTO_DARK_START_HOUR) {
    next.setHours(AUTO_DARK_START_HOUR, 0, 0, 0)
  } else {
    next.setDate(next.getDate() + 1)
    next.setHours(AUTO_DARK_END_HOUR, 0, 0, 0)
  }

  return Math.max(next.getTime() - now.getTime(), 1000)
}

/**
 * 监听自动模式的时间分界点。
 * 返回取消监听的函数。
 */
export function watchAutoTheme(onChange: () => void): () => void {
  let timer: number | undefined

  const schedule = () => {
    timer = window.setTimeout(() => {
      onChange()
      schedule()
    }, getNextAutoBoundaryDelay())
  }

  schedule()
  return () => {
    if (timer !== undefined) window.clearTimeout(timer)
  }
}
