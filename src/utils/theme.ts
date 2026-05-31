/**
 * 主题工具：在 <html> 上切换 `dark` class，供 Tailwind 暗色变体使用。
 * 三态：system（跟随系统）/ light / dark。
 */

import type { ThemeMode } from '@/utils/settings'

const mql = () => window.matchMedia('(prefers-color-scheme: dark)')

/** 给定模式下最终是否应为暗色 */
export function isDark(mode: ThemeMode): boolean {
  if (mode === 'system') return mql().matches
  return mode === 'dark'
}

/** 把主题应用到 <html>（增删 dark class） */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', isDark(mode))
}

/**
 * 监听系统配色变化；仅在 system 模式下才需要随系统切换。
 * 返回取消监听的函数。
 */
export function watchSystemTheme(onChange: () => void): () => void {
  const m = mql()
  m.addEventListener('change', onChange)
  return () => m.removeEventListener('change', onChange)
}

/** 三态循环：system → light → dark → system */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  const order: ThemeMode[] = ['system', 'light', 'dark']
  return order[(order.indexOf(mode) + 1) % order.length]
}
