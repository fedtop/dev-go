/**
 * 内容脚本的翻译总控：读取 / 监听设置，驱动整页翻译引擎与悬停翻译，汇总错误提示。
 */

import type { TranslateError } from '@/features/translate/errors'
import {
  isTranslateTargetSetting,
  type TranslateLangCode,
  type TranslateTargetSetting,
} from '@/features/translate/languages'
import { sendRuntimeMessage, type PageTranslationState } from '@/utils/messaging'
import {
  hoverTranslateMode,
  isHoverTranslateMode,
  isTranslateDisplayMode,
  translateAutoHosts,
  translateDisplayMode,
  translateLlmApiKey,
  translateLlmConfig,
  translateProvider,
  translateTargetLang,
  translateUnderline,
} from '@/utils/settings'

import { resolvePageTarget } from './detect'
import { HoverTranslator } from './hover'
import { hideToast, showToast } from './toast'
import { PageTranslator } from './translator'

export class PageTranslationController {
  private readonly engine = new PageTranslator({ onError: (error) => this.reportError(error) })
  private readonly hover = new HoverTranslator({
    toggle: (element, allowRemove) => this.handleHover(element, allowRemove),
  })
  private targetSetting: TranslateTargetSetting = 'auto'
  /** 悬停翻译的目标语言（首次使用时按页面语言解析） */
  private hoverTarget: TranslateLangCode | null = null
  private readonly reportedErrors = new Set<string>()
  private readonly unwatchers: Array<() => void> = []

  async init() {
    const [target, displayMode, underline, hoverMode, autoHosts] = await Promise.all([
      translateTargetLang.getValue(),
      translateDisplayMode.getValue(),
      translateUnderline.getValue(),
      hoverTranslateMode.getValue(),
      translateAutoHosts.getValue(),
    ])

    this.targetSetting = isTranslateTargetSetting(target) ? target : 'auto'
    this.engine.setDisplayMode(isTranslateDisplayMode(displayMode) ? displayMode : 'bilingual')
    this.engine.setUnderline(Boolean(underline))
    this.hover.setMode(isHoverTranslateMode(hoverMode) ? hoverMode : 'off')

    this.unwatchers.push(
      translateTargetLang.watch((value) => {
        this.targetSetting = isTranslateTargetSetting(value) ? value : 'auto'
        this.hoverTarget = null
        if (this.engine.isPageActive) this.engine.setTarget(resolvePageTarget(this.targetSetting))
      }),
      translateDisplayMode.watch((value) => {
        this.engine.setDisplayMode(isTranslateDisplayMode(value) ? value : 'bilingual')
      }),
      translateUnderline.watch((value) => this.engine.setUnderline(Boolean(value))),
      hoverTranslateMode.watch((value) => {
        this.hover.setMode(isHoverTranslateMode(value) ? value : 'off')
      }),
      // 引擎或其配置变化：清缓存，正在进行的整页翻译用新配置重来
      translateProvider.watch(() => this.resetProvider()),
      translateLlmConfig.watch(() => this.resetProvider()),
      translateLlmApiKey.watch(() => this.resetProvider()),
    )

    if (Array.isArray(autoHosts) && autoHosts.includes(window.location.hostname)) this.start()
  }

  get state(): PageTranslationState {
    return { active: this.engine.isPageActive }
  }

  start() {
    this.reportedErrors.clear()
    this.engine.startPage(resolvePageTarget(this.targetSetting))
  }

  stop() {
    this.engine.stopAll()
    hideToast()
  }

  toggle(): PageTranslationState {
    if (this.engine.isPageActive) this.stop()
    else this.start()
    return this.state
  }

  setEnabled(enabled: boolean): PageTranslationState {
    if (enabled !== this.engine.isPageActive) this.toggle()
    return this.state
  }

  destroy() {
    this.unwatchers.splice(0).forEach((unwatch) => unwatch())
    this.hover.destroy()
    this.engine.destroy()
    hideToast()
  }

  private resetProvider() {
    this.reportedErrors.clear()
    this.engine.resetProvider()
  }

  private handleHover(element: Element, allowRemove: boolean) {
    if (!this.engine.isPageActive) {
      this.hoverTarget ??= resolvePageTarget(this.targetSetting)
      this.engine.setTarget(this.hoverTarget)
    }
    this.engine.toggleElement(element, allowRemove)
  }

  /** 同类错误每次翻译只提示一次，避免整页失败时刷屏 */
  private reportError(error: TranslateError) {
    if (this.reportedErrors.has(error.code)) return
    this.reportedErrors.add(error.code)

    if (error.code === 'config' || error.code === 'auth') {
      showToast({
        message: `翻译服务不可用：${error.message}`,
        actionLabel: '打开设置',
        onAction: () => void sendRuntimeMessage({ type: 'open-options-page' }),
      })
      return
    }

    showToast({
      message: `部分段落翻译失败：${error.message}。点击段落后的 ↻ 可重试，或在 DevGo 弹窗中切换翻译引擎。`,
    })
  }
}
