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

/**
 * 打开浏览器的扩展快捷键设置（扩展无权自行修改快捷键）。
 * Chrome 有专门的快捷键页；Firefox 没有扩展能打开的地址，退回设置页「通用」的快捷键说明。
 */
export function openShortcutSettings(): Promise<unknown> {
  return import.meta.env.FIREFOX
    ? browser.tabs.create({ url: browser.runtime.getURL('/options.html#general') })
    : browser.tabs.create({ url: 'chrome://extensions/shortcuts' })
}
