/**
 * 翻译链路统一错误类型。
 *
 * Background 抛出 → 序列化为 { code, message } 经端口回传 → 内容脚本按 code 决定
 * 是否提示用户去配置、是否允许重试。
 */

export type TranslateErrorCode =
  /** 配置缺失或无效（如 AI 翻译未填写接口地址 / 模型） */
  | 'config'
  /** 鉴权失败（API Key 错误、token 失效） */
  | 'auth'
  /** 触发限流 */
  | 'rate-limit'
  /** 网络不可达 / 请求失败 */
  | 'network'
  /** 服务端返回错误 */
  | 'server'
  /** 返回内容无法解析 / 缺少对应段落 */
  | 'parse'
  /** 被取消 */
  | 'aborted'
  | 'unknown'

export interface TranslateErrorPayload {
  code: TranslateErrorCode
  message: string
}

export class TranslateError extends Error {
  readonly code: TranslateErrorCode

  constructor(code: TranslateErrorCode, message: string) {
    super(message)
    this.name = 'TranslateError'
    this.code = code
  }

  toJSON(): TranslateErrorPayload {
    return { code: this.code, message: this.message }
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof TranslateError && error.code === 'aborted')
  )
}

export function toTranslateError(error: unknown): TranslateError {
  if (error instanceof TranslateError) return error
  if (isAbortError(error)) return new TranslateError('aborted', '翻译已取消')
  if (error instanceof TypeError) {
    // fetch 网络层失败统一抛 TypeError（DNS、断网、证书、被拦截等）
    return new TranslateError('network', `网络请求失败：${error.message}`)
  }
  const message = error instanceof Error ? error.message : String(error)
  return new TranslateError('unknown', message || '未知错误')
}

/** 按 HTTP 状态码归类错误 */
export function httpStatusToError(status: number, detail: string): TranslateError {
  const suffix = detail ? `：${detail}` : ''
  if (status === 401 || status === 403) {
    return new TranslateError('auth', `鉴权失败（${status}）${suffix}`)
  }
  if (status === 429) return new TranslateError('rate-limit', `请求过于频繁（429）${suffix}`)
  if (status === 404) return new TranslateError('config', `接口地址或模型不存在（404）${suffix}`)
  if (status >= 400 && status < 500) {
    return new TranslateError('config', `请求参数无效（${status}）${suffix}`)
  }
  return new TranslateError('server', `服务端错误（${status}）${suffix}`)
}

/**
 * AI 服务错误的用户提示（不含服务端原文：原文可能是英文、含打码的 Key，只适合放在 title 里排查）。
 */
export function describeServiceError(code: TranslateErrorCode | 'timeout'): string {
  switch (code) {
    case 'auth':
      return 'API Key 无效，或不属于当前接口地址对应的服务'
    case 'config':
      return '接口地址或模型不正确'
    case 'network':
      return '无法连接到接口地址，请检查网络或地址是否正确'
    case 'timeout':
      return '请求超时，请稍后重试'
    case 'rate-limit':
      return '请求过于频繁或额度不足，请稍后重试'
    case 'server':
      return '服务端出错，请稍后重试'
    case 'parse':
      return '服务返回了无法识别的内容'
    default:
      return '请求失败'
  }
}
