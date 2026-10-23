/**
 * 翻译相关设置的界面选项（popup 与选项页共用，保证文案一致）。
 */

import { isMac } from '@/utils/shortcut'
import type { HoverTranslateMode, TranslateDisplayMode, TranslateProvider } from '@/utils/settings'

export const PROVIDER_OPTIONS: Array<{ value: TranslateProvider; label: string }> = [
  { value: 'microsoft', label: '微软 · 免翻墙' },
  { value: 'google', label: 'Google · 需翻墙' },
  { value: 'llm', label: 'AI 大模型' },
]

export const DISPLAY_MODE_OPTIONS: Array<{ value: TranslateDisplayMode; label: string }> = [
  { value: 'bilingual', label: '双语对照' },
  { value: 'translation', label: '仅译文' },
]

const ALT_LABEL = isMac ? '⌥ Option' : 'Alt'
const CTRL_LABEL = isMac ? '⌃ Control' : 'Ctrl'
const SHIFT_LABEL = isMac ? '⇧ Shift' : 'Shift'

export const HOVER_MODE_OPTIONS: Array<{ value: HoverTranslateMode; label: string }> = [
  { value: 'off', label: '关闭' },
  { value: 'alt', label: `按 ${ALT_LABEL}` },
  { value: 'ctrl', label: `按 ${CTRL_LABEL}` },
  { value: 'shift', label: `按 ${SHIFT_LABEL}` },
  { value: 'dwell', label: '停留自动翻译' },
]

export function describeHoverMode(mode: HoverTranslateMode): string {
  switch (mode) {
    case 'alt':
      return `鼠标指向段落，按一下 ${ALT_LABEL} 翻译，再按一次恢复`
    case 'ctrl':
      return `鼠标指向段落，按一下 ${CTRL_LABEL} 翻译，再按一次恢复`
    case 'shift':
      return `鼠标指向段落，按一下 ${SHIFT_LABEL} 翻译，再按一次恢复`
    case 'dwell':
      return '鼠标在段落上停留片刻自动翻译'
    case 'off':
    default:
      return '已关闭'
  }
}
