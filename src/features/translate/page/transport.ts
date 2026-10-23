/**
 * 内容脚本侧的翻译端口客户端。
 *
 * 懒建立到 Background 的长连接，多个批次复用；Service Worker 重启或扩展重载导致断开时，
 * 在途请求以可重试错误结束，下次请求自动重连。
 */

import { TranslateError, type TranslateErrorPayload } from '@/features/translate/errors'
import type { TranslateLangCode } from '@/features/translate/languages'
import {
  TRANSLATE_PORT_NAME,
  type TranslatePageContext,
  type TranslatePortEvent,
  type TranslatePortRequest,
  type TranslateSegment,
} from '@/utils/messaging'

export interface TranslateBatchHandlers {
  onSegment: (id: string, text: string) => void
  onSegmentError: (id: string, error: TranslateError) => void
}

interface PendingRequest extends TranslateBatchHandlers {
  resolve: () => void
  reject: (error: TranslateError) => void
}

function fromPayload(payload: TranslateErrorPayload): TranslateError {
  return new TranslateError(payload.code, payload.message)
}

let requestSeed = 0

export class TranslatePortClient {
  private port: Browser.runtime.Port | null = null
  private readonly pending = new Map<string, PendingRequest>()

  /** 发送一批段落；Promise 在整批结束（done）时 resolve，期间逐段回调 */
  translate(
    segments: TranslateSegment[],
    target: TranslateLangCode,
    context: TranslatePageContext | undefined,
    handlers: TranslateBatchHandlers,
  ): { promise: Promise<void>; cancel: () => void } {
    requestSeed += 1
    const requestId = `${Date.now().toString(36)}-${requestSeed}`

    const promise = new Promise<void>((resolve, reject) => {
      this.pending.set(requestId, { ...handlers, resolve, reject })
      try {
        this.post({ type: 'translate', requestId, target, segments, context })
      } catch (error) {
        this.pending.delete(requestId)
        reject(error instanceof TranslateError ? error : this.disconnectedError())
      }
    })

    const cancel = () => {
      const request = this.pending.get(requestId)
      if (!request) return
      this.pending.delete(requestId)
      request.reject(new TranslateError('aborted', '翻译已取消'))
      try {
        this.port?.postMessage({ type: 'cancel', requestId } satisfies TranslatePortRequest)
      } catch {
        // 端口已断开，无需通知
      }
    }

    return { promise, cancel }
  }

  /** 取消所有在途请求并断开连接 */
  dispose() {
    const error = new TranslateError('aborted', '翻译已取消')
    this.pending.forEach((request) => request.reject(error))
    this.pending.clear()
    this.port?.disconnect()
    this.port = null
  }

  private disconnectedError(): TranslateError {
    return new TranslateError('network', '与扩展后台的连接已断开，请重试；若扩展刚更新请刷新页面')
  }

  private post(message: TranslatePortRequest) {
    this.ensurePort().postMessage(message)
  }

  private ensurePort(): Browser.runtime.Port {
    if (this.port) return this.port

    let port: Browser.runtime.Port
    try {
      port = browser.runtime.connect({ name: TRANSLATE_PORT_NAME })
    } catch {
      // 扩展被重新加载后旧内容脚本的上下文失效，无法再连接
      throw new TranslateError('config', '扩展已更新，请刷新页面后重试')
    }

    port.onMessage.addListener((event: TranslatePortEvent) => this.handleEvent(event))
    port.onDisconnect.addListener(() => {
      if (this.port !== port) return
      this.port = null
      const error = this.disconnectedError()
      this.pending.forEach((request) => request.reject(error))
      this.pending.clear()
    })

    this.port = port
    return port
  }

  private handleEvent(event: TranslatePortEvent) {
    const request = this.pending.get(event.requestId)
    if (!request) return

    switch (event.type) {
      case 'segment':
        request.onSegment(event.id, event.text)
        break
      case 'segment-error':
        request.onSegmentError(event.id, fromPayload(event.error))
        break
      case 'done':
        this.pending.delete(event.requestId)
        request.resolve()
        break
      case 'error':
        this.pending.delete(event.requestId)
        request.reject(fromPayload(event.error))
        break
      default:
        break
    }
  }
}
