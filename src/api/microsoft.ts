/**
 * 微软（Edge）免费翻译接口。
 *
 * 复用 Edge 浏览器自带翻译所使用的内部接口：
 * - 通过 `edge.microsoft.com/translate/auth` 获取临时 JWT（有效期约 10 分钟）
 * - 通过 `api-edge.cognitive.microsofttranslator.com/translate` 翻译文本
 *
 * 该接口国内可直连、免费、无需翻墙；但属于微软未公开文档的内部接口，
 * 仅供个人学习使用，可能随时变动。
 */

import type { DictResult } from '@/types/dict'
import { hasChinese, pickTarget } from '@/utils/lang'

const AUTH_URL = 'https://edge.microsoft.com/translate/auth'
const TRANS_URL = 'https://api-edge.cognitive.microsofttranslator.com/translate'
const LOOKUP_URL =
  'https://api-edge.cognitive.microsofttranslator.com/dictionary/lookup?api-version=3.0&from={from}&to={to}'
const MICROSOFT_BATCH_SIZE = 25

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
async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expireAt) {
    return tokenCache.token
  }
  const res = await fetch(AUTH_URL, {
    headers: {
      accept: '*/*',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  })
  if (!res.ok) throw new Error(`auth failed: ${res.status}`)
  const token = await res.text()
  tokenCache = { token, expireAt: parseJwtExpire(token) }
  return token
}

function buildTranslateUrl(target: string, html?: boolean): string {
  const params = new URLSearchParams({
    'api-version': '3.0',
    to: target,
  })
  if (html) params.set('textType', 'html')
  return `${TRANS_URL}?${params.toString()}`
}

async function requestMicrosoftTranslate(
  texts: string[],
  html: boolean,
  target: string,
): Promise<string[]> {
  const token = await getToken()
  const res = await fetch(buildTranslateUrl(target, html), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(texts.map((text) => ({ Text: text }))),
  })

  if (!res.ok) {
    if (res.status === 401) tokenCache = null
    throw new Error(`translate failed: ${res.status}`)
  }

  const data: MicrosoftTransItem[] = await res.json()
  return texts.map((_, index) => data[index]?.translations?.[0]?.text ?? '')
}

/** 微软翻译（整句机器翻译；默认中英互译：含中文译英，否则译中）
 *  html=true 时用 HTML 模式翻译，保留 a/b 等内联标签 */
export async function microsoftTrans(text: string, html?: boolean, to?: string): Promise<string> {
  if (!text.trim()) return ''

  // 未指定目标语言时按源文本自动判断方向
  const target = to ?? pickTarget(text, { zh: 'zh-Hans', en: 'en' })

  try {
    const [result] = await microsoftTransList([text], html, target)
    return result ?? ''
  } catch (error) {
    console.error('[DevGo] microsoftTrans failed:', error)
    return ''
  }
}

/** 微软批量翻译：同一目标语言、同一 textType 下合并请求，减少整页翻译的请求数。 */
export async function microsoftTransList(
  texts: string[],
  html?: boolean,
  to?: string,
): Promise<string[]> {
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
        const sourceTexts = indexed.map(({ text }) => text)
        let translated: string[]
        try {
          translated = await requestMicrosoftTranslate(sourceTexts, Boolean(html), target)
        } catch (error) {
          // Edge token 偶尔会提前失效；401 后清缓存并重试一次。
          if (tokenCache !== null) throw error
          translated = await requestMicrosoftTranslate(sourceTexts, Boolean(html), target)
        }

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

/** 测试微软翻译连通性 */
export async function testMicrosoftTrans(): Promise<boolean> {
  try {
    const result = await microsoftTrans('hello')
    return Boolean(result)
  } catch {
    return false
  }
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
