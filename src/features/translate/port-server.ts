/**
 * Background 侧的整页翻译端口：每个内容脚本建立一条长连接，
 * 请求按 requestId 并发执行，结果逐段推回；端口断开（页面关闭 / 刷新）即中止所有请求。
 */

import { toTranslateError } from '@/features/translate/errors'
import { runTranslateJob } from '@/features/translate/service'
import type { TranslatePortEvent, TranslatePortRequest } from '@/utils/messaging'

export function handleTranslatePort(port: Browser.runtime.Port) {
  const controllers = new Map<string, AbortController>()
  let connected = true

  const post = (event: TranslatePortEvent) => {
    if (!connected) return
    try {
      port.postMessage(event)
    } catch {
      // 端口已失效（页面已卸载），后续结果直接丢弃
      connected = false
    }
  }

  const startRequest = (request: Extract<TranslatePortRequest, { type: 'translate' }>) => {
    const { requestId, segments } = request
    const controller = new AbortController()
    controllers.get(requestId)?.abort()
    controllers.set(requestId, controller)

    runTranslateJob({
      texts: segments.map((segment) => segment.text),
      target: request.target,
      context: request.context,
      signal: controller.signal,
      onResult: (index, result) => {
        const segment = segments[index]
        if (!segment || controller.signal.aborted) return
        post(
          'text' in result
            ? { type: 'segment', requestId, id: segment.id, text: result.text }
            : { type: 'segment-error', requestId, id: segment.id, error: result.error.toJSON() },
        )
      },
    })
      .then(() => {
        if (!controller.signal.aborted) post({ type: 'done', requestId })
      })
      .catch((error: unknown) => {
        const translateError = toTranslateError(error)
        if (translateError.code !== 'aborted') {
          post({ type: 'error', requestId, error: translateError.toJSON() })
        }
      })
      .finally(() => {
        if (controllers.get(requestId) === controller) controllers.delete(requestId)
      })
  }

  port.onMessage.addListener((message: TranslatePortRequest) => {
    if (message?.type === 'translate') {
      startRequest(message)
    } else if (message?.type === 'cancel') {
      controllers.get(message.requestId)?.abort()
      controllers.delete(message.requestId)
    }
  })

  port.onDisconnect.addListener(() => {
    connected = false
    controllers.forEach((controller) => controller.abort())
    controllers.clear()
  })
}
