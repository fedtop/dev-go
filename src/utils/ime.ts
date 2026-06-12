/**
 * 输入法（IME）组词态判断：避免拼音 / 日文等输入过程中回车被当作提交。
 * 三重判定兼容不同浏览器：本地 composition 状态、原生 isComposing、以及 keyCode 229 兜底。
 */

import type { KeyboardEvent } from 'react'

export function isImeComposing(e: KeyboardEvent<HTMLInputElement>, composing: boolean): boolean {
  return composing || e.nativeEvent.isComposing || e.keyCode === 229
}
