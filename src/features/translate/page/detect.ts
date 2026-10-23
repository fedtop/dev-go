/**
 * 页面主语言粗判：采样可见文字（标题 + 前若干段正文），用于 auto 目标语言。
 */

import {
  detectScript,
  type TranslateLangCode,
  type TranslateTargetSetting,
} from '@/features/translate/languages'

const SAMPLE_LIMIT = 2000
const SKIP_SELECTOR = 'script,style,noscript,template,pre,code,textarea,devgo-trans'

export function samplePageText(root: Element = document.body, limit = SAMPLE_LIMIT): string {
  let text = `${document.title} `
  if (!root) return text

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || parent.closest(SKIP_SELECTOR) || !node.textContent?.trim()) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  while (text.length < limit && walker.nextNode()) text += `${walker.currentNode.textContent} `
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
