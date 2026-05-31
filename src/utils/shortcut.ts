/** 平台相关的快捷键显示 */

/** 是否 Mac 平台 */
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/**
 * 把 manifest 风格的快捷键（如 "Alt+1" / "Ctrl+Shift+E"）
 * 转成当前平台的展示文本：Mac 用符号（⌥⌘⇧⌃），其它平台保留单词。
 */
export function formatShortcut(combo: string): string {
  if (!isMac) return combo

  return combo
    .split('+')
    .map((key) => {
      switch (key.toLowerCase()) {
        case 'alt':
          return '⌥'
        case 'ctrl':
        case 'control':
          return '⌃'
        case 'shift':
          return '⇧'
        case 'cmd':
        case 'command':
        case 'meta':
          return '⌘'
        default:
          return key
      }
    })
    .join('')
}
