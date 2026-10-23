/**
 * 整页翻译注入样式：只在开始翻译时插入一次，停止翻译后移除。
 * 所有规则都限定在 DevGo 自定义元素 / class 上，不影响页面原有样式。
 */

import {
  HIDDEN_ORIGINAL_CLASS,
  LOADING_TAG,
  RETRY_TAG,
  ROOT_TRANSLATION_ONLY_CLASS,
  ROOT_UNDERLINE_CLASS,
  STYLE_ID,
  TEXT_TAG,
  UNCLAMP_CLASS,
  WRAPPER_TAG,
} from './constants'

const BASE_STYLES = `
${WRAPPER_TAG} {
  display: inline;
}
${WRAPPER_TAG}[data-layout="inline"]::before {
  content: " ";
}
${WRAPPER_TAG}[data-layout="block"] {
  display: block;
  margin: 0.35em 0 0.15em;
}
${WRAPPER_TAG}[data-state="same"] {
  display: none !important;
}
html.${ROOT_TRANSLATION_ONLY_CLASS} ${WRAPPER_TAG}[data-detached]::before {
  content: none;
}
html.${ROOT_TRANSLATION_ONLY_CLASS} ${WRAPPER_TAG}[data-detached][data-layout="block"] {
  margin: 0;
}
${TEXT_TAG} {
  overflow-wrap: anywhere;
}
html.${ROOT_UNDERLINE_CLASS} ${WRAPPER_TAG}:not([data-detached]) ${TEXT_TAG} {
  text-decoration: underline dashed rgba(128, 128, 128, 0.65);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.3em;
}
${LOADING_TAG} {
  display: inline-block;
  width: 0.75em;
  height: 0.75em;
  margin: 0 0.35em;
  vertical-align: -0.08em;
  box-sizing: border-box;
  border: 2px solid rgba(128, 128, 128, 0.25);
  border-top-color: rgba(79, 70, 229, 0.85);
  border-radius: 50%;
  animation: devgo-trans-spin 0.7s linear infinite;
}
${RETRY_TAG} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3em;
  height: 1.3em;
  margin: 0 0.3em;
  border-radius: 50%;
  vertical-align: -0.2em;
  color: #ef4444;
  font: 600 0.85em/1 system-ui, sans-serif;
  cursor: pointer;
  user-select: none;
}
${RETRY_TAG}:hover {
  background: rgba(239, 68, 68, 0.12);
}
.${UNCLAMP_CLASS} {
  -webkit-line-clamp: unset !important;
  line-clamp: unset !important;
  max-height: none !important;
}
.${HIDDEN_ORIGINAL_CLASS} {
  display: none !important;
}
@keyframes devgo-trans-spin {
  to {
    transform: rotate(360deg);
  }
}
`

export function injectTranslateStyle(siteStyles: string) {
  let style = document.getElementById(STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    ;(document.head || document.documentElement).appendChild(style)
  }
  style.textContent = `${BASE_STYLES}\n${siteStyles}`
}

export function removeTranslateStyle() {
  document.getElementById(STYLE_ID)?.remove()
}
