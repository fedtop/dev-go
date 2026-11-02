import { useCallback, useEffect, useRef, useState } from 'react'

import type { SelectionAiAction, SelectionContext } from '@/features/ai/actions'
import { describeServiceError } from '@/features/translate/errors'
import {
  SELECTION_AI_PORT_NAME,
  type SelectionAiEvent,
  type SelectionAiRequest,
} from '@/utils/messaging'

export interface AiResult {
  status: 'loading' | 'streaming' | 'done' | 'error'
  text: string
  reasoning: string
  error?: string
}

const EMPTY: AiResult = { status: 'loading', text: '', reasoning: '' }

/**
 * 通过后台长连接执行划词 AI 动作并流式接收结果。
 * 每次 run 新建一条连接；stop / 再次 run / 卸载时断开连接，后台随之取消请求。
 */
export function useSelectionAi() {
  const [result, setResult] = useState<AiResult | null>(null)
  const portRef = useRef<Browser.runtime.Port | null>(null)

  const stop = useCallback(() => {
    portRef.current?.disconnect()
    portRef.current = null
  }, [])

  const run = useCallback(
    (action: SelectionAiAction, text: string, context: SelectionContext) => {
      stop()
      setResult(EMPTY)

      let port: Browser.runtime.Port
      try {
        port = browser.runtime.connect({ name: SELECTION_AI_PORT_NAME })
      } catch {
        setResult({ ...EMPTY, status: 'error', error: '扩展已更新，请刷新页面后重试' })
        return
      }
      portRef.current = port

      port.onMessage.addListener((event: SelectionAiEvent) => {
        if (portRef.current !== port) return
        setResult((current) => {
          const base = current ?? EMPTY
          switch (event.type) {
            case 'reasoning':
              return { ...base, reasoning: base.reasoning + event.delta }
            case 'text':
              return { ...base, status: 'streaming', text: base.text + event.delta }
            case 'done':
              return base.text.trim()
                ? { ...base, status: 'done' }
                : { ...base, status: 'error', error: '模型没有返回内容' }
            case 'error': {
              const friendly = describeServiceError(event.error.code)
              return {
                ...base,
                status: 'error',
                error:
                  event.error.message && event.error.message !== friendly
                    ? `${friendly}：${event.error.message}`
                    : friendly,
              }
            }
          }
        })
        if (event.type === 'done' || event.type === 'error') stop()
      })
      port.onDisconnect.addListener(() => {
        if (portRef.current !== port) return
        portRef.current = null
        setResult((current) =>
          current && (current.status === 'loading' || current.status === 'streaming')
            ? { ...current, status: 'error', error: '连接中断，请重试' }
            : current,
        )
      })

      const request: SelectionAiRequest = { type: 'run', action, text, context }
      port.postMessage(request)
    },
    [stop],
  )

  const reset = useCallback(() => {
    stop()
    setResult(null)
  }, [stop])

  useEffect(() => stop, [stop])

  return { result, run, reset }
}
