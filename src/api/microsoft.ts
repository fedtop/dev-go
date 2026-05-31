/**
 * 微软（Edge）免费翻译接口。
 *
 * 参考沉浸式翻译等工具的做法，复用 Edge 浏览器自带翻译所使用的内部接口：
 * - 通过 `edge.microsoft.com/translate/auth` 获取临时 JWT（有效期约 10 分钟）
 * - 通过 `api-edge.cognitive.microsofttranslator.com/translate` 翻译文本
 *
 * 该接口国内可直连、免费、无需翻墙；但属于微软未公开文档的内部接口，
 * 仅供个人学习使用，可能随时变动。
 */

import type { DictResult } from '@/types/dict'
import { hasChinese, pickTarget } from '@/utils/lang'

const AUTH_URL = 'https://edge.microsoft.com/translate/auth'
const TRANS_URL =
  'https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&from={from}&to={to}'
const LOOKUP_URL =
  'https://api-edge.cognitive.microsofttranslator.com/dictionary/lookup?api-version=3.0&from={from}&to={to}'

interface MicrosoftTransItem {
  translations: Array<{ text: string; to: string }>
}

// JWT 缓存（含过期时间），避免每次翻译都重新取 token
let tokenCache: { token: string; expireAt: number } | null = null

/** 解析 JWT 的 exp（秒），失败则给一个保守的过期时间 */
function parseJwtExpire(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
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
  const res = await fetch(AUTH_URL)
  if (!res.ok) throw new Error(`auth failed: ${res.status}`)
  const token = await res.text()
  tokenCache = { token, expireAt: parseJwtExpire(token) }
  return token
}

/** 微软翻译（整句机器翻译；默认中英互译：含中文译英，否则译中）
 *  html=true 时用 HTML 模式翻译，保留 a/b 等内联标签 */
export async function microsoftTrans(text: string, html?: boolean, to?: string): Promise<string> {
  if (!text.trim()) return ''

  // 未指定目标语言时按源文本自动判断方向
  const target = to ?? pickTarget(text, { zh: 'zh-Hans', en: 'en' })

  try {
    const token = await getToken()
    let url = TRANS_URL.replace('{from}', '').replace('{to}', target)
    if (html) url += '&textType=html'

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify([{ Text: text }]),
    })

    if (!res.ok) {
      // token 可能失效，清掉缓存下次重取
      if (res.status === 401) tokenCache = null
      return ''
    }

    const data: MicrosoftTransItem[] = await res.json()
    return data[0]?.translations?.[0]?.text ?? ''
  } catch (error) {
    console.error('[DevGo] microsoftTrans failed:', error)
    return ''
  }
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
