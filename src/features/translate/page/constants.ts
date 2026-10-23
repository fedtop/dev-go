/**
 * 整页翻译注入到页面里的标签 / class / 属性名。
 *
 * 译文容器使用自定义元素名（含连字符，浏览器按普通行内 HTMLElement 处理）：
 * 网站 CSS 几乎不会命中它们，也方便统一识别、清理 DevGo 自己的节点。
 */

/** 段落译文容器（插在原文最后一个节点之后） */
export const WRAPPER_TAG = 'devgo-trans'
/** 译文正文 */
export const TEXT_TAG = 'devgo-trans-text'
/** 翻译中转圈 */
export const LOADING_TAG = 'devgo-trans-loading'
/** 失败重试按钮 */
export const RETRY_TAG = 'devgo-trans-retry'

export const STYLE_ID = 'devgo-translate-style'

/** <html> 上的状态 class */
export const ROOT_UNDERLINE_CLASS = 'devgo-trans-underline'
export const ROOT_TRANSLATION_ONLY_CLASS = 'devgo-trans-only'

/** 取消原文祖先的多行截断，避免译文被裁掉 */
export const UNCLAMP_CLASS = 'devgo-trans-unclamp'
/** 「仅译文」模式下隐藏的原文元素 */
export const HIDDEN_ORIGINAL_CLASS = 'devgo-trans-hidden-original'

/** DevGo 自己注入的 UI（译文容器、划词气泡、提示条），遍历与监听时一律跳过 */
export const OWN_UI_SELECTOR = [WRAPPER_TAG, 'devgo-selection-ui', 'devgo-toast'].join(',')

/** 译文较长时独占一行展示的阈值（中日韩等宽字符按 2 计） */
export const BLOCK_LAYOUT_MIN_LENGTH = 40
