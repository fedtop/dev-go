/** 语言方向判断：含中文 → 翻成英文；否则 → 翻成中文 */

/** 文本是否包含中文 */
export function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text)
}

/** 各引擎的目标语言代码 */
export interface LangCodes {
  /** 中文目标码 */
  zh: string
  /** 英文目标码 */
  en: string
}

/** 根据源文本判断目标语言：含中文则译英，否则译中 */
export function pickTarget(text: string, codes: LangCodes): string {
  return hasChinese(text) ? codes.en : codes.zh
}
