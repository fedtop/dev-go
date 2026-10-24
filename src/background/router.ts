/**
 * Background runtime 消息路由。
 *
 * 每种消息对应一个处理函数（类型由 utils/messaging.ts 的 RuntimeMessage / RuntimeResponseMap 约束，
 * 新增消息类型时这里漏写会编译报错）。处理函数抛错时统一回复 RuntimeErrorResponse，
 * 调用方的 sendRuntimeMessage 会因此 reject，而不是永远等不到响应。
 */
import type { RuntimeErrorResponse, RuntimeMessage, RuntimeResponseMap } from '@/utils/messaging'

type MessageType = RuntimeMessage['type']

type MessageHandler<K extends MessageType> = (
  message: Extract<RuntimeMessage, { type: K }>,
  sender: Browser.runtime.MessageSender,
) => Promise<RuntimeResponseMap[K]> | RuntimeResponseMap[K]

export type MessageHandlers = { [K in MessageType]: MessageHandler<K> }

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return (
    typeof value === 'object' && value != null && typeof (value as RuntimeMessage).type === 'string'
  )
}

export function registerMessageRouter(handlers: MessageHandlers) {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isRuntimeMessage(message) || !Object.hasOwn(handlers, message.type)) {
      // 不是发给后台的消息（如后台发给 popup 的 popup-shortcut），交给其他监听方
      return false
    }

    const handler = handlers[message.type] as MessageHandler<MessageType>
    Promise.resolve()
      .then(() => handler(message as never, sender))
      .then(sendResponse, (error: unknown) => {
        console.warn(`[DevGo] message "${message.type}" failed:`, error)
        const response: RuntimeErrorResponse = {
          devgoError: error instanceof Error ? error.message : String(error),
        }
        sendResponse(response)
      })
    return true // 保持消息通道打开，等待异步响应
  })
}
