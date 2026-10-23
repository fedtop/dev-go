/**
 * 微软（Edge）免费翻译接口。
 *
 * - 翻译：`edge.microsoft.com/translate/translatetext`（Edge 内置翻译使用的接口，
 *   无需 token，请求体为字符串数组，可批量；纯文本模式会原样保留 <bN> 占位标记）
 * - 词典：`api-edge.cognitive.microsofttranslator.com/dictionary/lookup`，
 *   需先经 `edge.microsoft.com/translate/auth` 取临时 JWT（该鉴权接口目前可能不可用，失败时查词返回空）
 *
 * 接口国内可直连、免费、无需翻墙；但属于微软未公开文档的内部接口，
 * 仅供个人学习使用，可能随时变动。
 */

import { httpStatusToError, TranslateError } from '@/features/translate/errors'
import type { DictResult } from '@/types/dict'
import { hasChinese, pickTarget } from '@/utils/lang'

const AUTH_URL = 'https://edge.microsoft.com/translate/auth'
const TRANS_URL = 'https://edge.microsoft.com/translate/translatetext'
const LOOKUP_URL =
  'https://api-edge.cognitive.microsofttranslator.com/dictionary/lookup?api-version=3.0&from={from}&to={to}'
/** 单次请求的最大条数（保守取值，避免单个请求过大） */
export const MICROSOFT_BATCH_SIZE = 25

interface MicrosoftTransItem {
  translations: Array<{ text: string; to: string }>
}

// JWT 缓存（含过期时间），避免每次翻译都重新取 token
let tokenCache: { token: string; expireAt: number } | null = null

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return atob(padded)
}

/** 解析 JWT 的 exp（秒），失败则给一个保守的过期时间 */
function parseJwtExpire(token: string): number {
  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1]))
    if (typeof payload.exp === 'number') {
      // 提前 30s 过期，留出网络余量
      return payload.exp * 1000 - 30_000
    }
  } catch {
    /* ignore */
  }
  // 兜底：默认 8 分钟有效
  return Date.now() + 8 * 60 * 1000
}

/** 获取（并缓存）翻译用的临时 token */
async function getToken(signal?: AbortSignal): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expireAt) {
    return tokenCache.token
  }
  const res = await fetch(AUTH_URL, {
    headers: {
      accept: '*/*',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
    signal,
  })
  if (!res.ok) throw new TranslateError('auth', `微软翻译鉴权失败（${res.status}）`)
  const token = await res.text()
  if (!token) throw new TranslateError('auth', '微软翻译鉴权失败：未获取到 token')
  tokenCache = { token, expireAt: parseJwtExpire(token) }
  return token
}

/**
 * 微软批量翻译（单次请求，调用方负责分块，建议 ≤ 25 条）。失败直接抛 TranslateError。
 * 文本按纯文本翻译：<bN>…</bN> 占位标记会被原样保留在译文中。
 */
export async function microsoftTranslate(
  texts: string[],
  target: string,
  options: { signal?: AbortSignal } = {},
): Promise<string[]> {
  const params = new URLSearchParams({ to: target, isEnterpriseClient: 'false' })
  const res = await fetch(`${TRANS_URL}?${params.toString()}`, {
    method: 'POST',
    headers: { accept: '*/*', 'content-type': 'application/json' },
    body: JSON.stringify(texts),
    credentials: 'omit',
    signal: options.signal,
  })
  if (!res.ok) throw httpStatusToError(res.status, '微软翻译')

  const data: unknown = await res.json()
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new TranslateError('parse', '微软翻译返回的结果数量与请求不一致')
  }
  return (data as MicrosoftTransItem[]).map((item) => item?.translations?.[0]?.text ?? '')
}

/** 微软翻译（整句机器翻译；默认中英互译：含中文译英，否则译中；失败返回空串） */
export async function microsoftTrans(text: string, to?: string): Promise<string> {
  if (!text.trim()) return ''

  // 未指定目标语言时按源文本自动判断方向
  const target = to ?? pickTarget(text, { zh: 'zh-Hans', en: 'en' })

  try {
    const [result] = await microsoftTransList([text], target)
    return result ?? ''
  } catch (error) {
    console.error('[DevGo] microsoftTrans failed:', error)
    return ''
  }
}

/** 微软批量翻译（吞掉错误，失败项为空串）：供查词等容错场景使用 */
export async function microsoftTransList(texts: string[], to?: string): Promise<string[]> {
  const results = Array(texts.length).fill('')
  const target = to ?? pickTarget(texts.join('\n'), { zh: 'zh-Hans', en: 'en' })
  const chunkCount = Math.ceil(texts.length / MICROSOFT_BATCH_SIZE)

  await Promise.all(
    Array.from({ length: chunkCount }, async (_, chunkIndex) => {
      const start = chunkIndex * MICROSOFT_BATCH_SIZE
      const chunk = texts.slice(start, start + MICROSOFT_BATCH_SIZE)
      const indexed = chunk
        .map((text, offset) => ({ text, offset }))
        .filter(({ text }) => text.trim())

      if (indexed.length === 0) return

      try {
        const translated = await microsoftTranslate(
          indexed.map(({ text }) => text),
          target,
        )
        indexed.forEach(({ offset }, index) => {
          results[start + offset] = translated[index] ?? ''
        })
      } catch (error) {
        console.error('[DevGo] microsoftTransList failed:', error)
      }
    }),
  )

  return results
}

interface MicrosoftLookupItem {
  displaySource: string
  translations: Array<{ displayTarget: string; posTag: string }>
}

/** 微软词典查词：返回按词性分组的释义（自动判断中英方向） */
export async function microsoftLookup(word: string): Promise<DictResult | null> {
  // 词典接口必须指定 from/to：中文词查英文释义，英文词查中文释义
  const zh = hasChinese(word)
  const from = zh ? 'zh-Hans' : 'en'
  const to = zh ? 'en' : 'zh-Hans'

  try {
    const token = await getToken()
    const url = LOOKUP_URL.replace('{from}', from).replace('{to}', to)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify([{ Text: word }]),
    })
    if (!res.ok) {
      if (res.status === 401) tokenCache = null
      return null
    }

    const data: MicrosoftLookupItem[] = await res.json()
    const translations = data[0]?.translations ?? []
    if (translations.length === 0) return null

    // 按词性分组
    const grouped = new Map<string, string[]>()
    translations.forEach(({ displayTarget, posTag }) => {
      const pos = (posTag || '').toLowerCase()
      const list = grouped.get(pos) ?? []
      if (!list.includes(displayTarget)) list.push(displayTarget)
      grouped.set(pos, list)
    })

    return {
      word: data[0]?.displaySource || word,
      entries: [...grouped].map(([pos, terms]) => ({ pos, terms })),
    }
  } catch (error) {
    console.error('[DevGo] microsoftLookup failed:', error)
    return null
  }
}
