/**
 * 页面主语言粗判：采样可见文字（标题 + 前若干段正文），用于 auto 目标语言。
 */

import {
  detectScript,
  type TranslateLangCode,
  type TranslateTargetSetting,
} from '@/features/translate/languages'

import { composedChildNodes } from './dom'

const SAMPLE_LIMIT = 2000
const SKIP_SELECTOR = 'script,style,noscript,template,pre,code,textarea,devgo-trans'

/** 沿渲染树采样文字（进入开放的 shadow root），Web Components 页面的正文都在 shadow 里 */
export function samplePageText(root: Element = document.body, limit = SAMPLE_LIMIT): string {
  let text = `${document.title} `
  if (!root) return text

  const visit = (node: Node) => {
    if (text.length >= limit) return
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) text += `${node.textContent} `
      return
    }
    if (node instanceof Element && node.matches(SKIP_SELECTOR)) return
    composedChildNodes(node).forEach(visit)
  }
  visit(root)
  return text
}

/** auto：中文页面译成英文，其余译成简体中文；页面没有可识别文字时参考 <html lang> */
export function resolvePageTarget(setting: TranslateTargetSetting): TranslateLangCode {
  if (setting !== 'auto') return setting

  const script = detectScript(samplePageText())
  if (script === 'han') return 'en'
  if (script === 'none' && document.documentElement.lang.toLowerCase().startsWith('zh')) return 'en'
  return 'zh-CN'
}
