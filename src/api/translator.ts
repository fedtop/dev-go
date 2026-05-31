import type { DictResult } from '@/types/dict'
import { pickTarget } from '@/utils/lang'

export interface YoudaoTransRes {
  query: string
  isWord: boolean
  /** 译文发音 mp3 */
  tSpeakUrl: string
  /** 原文发音 mp3 */
  speakUrl: string
  /** 翻译信息 */
  basic?: {
    /** 发音 */
    phonetic: string
    /** 释义 */
    explains: string[]
  }
  /** 网络释义 */
  web?: Array<{
    key: string
    value: string[]
  }>
  /** 机器翻译 */
  translation?: string[]
}

interface GoogleTransRes {
  sentences: Array<{ trans: string; orig: string; backend: number }>
  src: string
  confidence: number
  spell: object
  /** 词典（dt=bd 时返回，按词性分组） */
  dict?: Array<{ pos: string; terms: string[] }>
  ld_result: {
    srclangs: string[]
    srclangs_confidences: number[]
    extended_srclangs: string[]
  }
}

const GOOGLE_ENDPOINT = 'https://translate.google.com/translate_a/single'

/** 有道翻译（查词，返回词典释义） */
export async function youdaoTrans(queryStr: string): Promise<YoudaoTransRes | null> {
  const url = `http://aidemo.youdao.com/trans?q=${encodeURIComponent(queryStr)}&from=Auto&to=Auto`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as YoudaoTransRes
  } catch (error) {
    console.error('[DevGo] youdaoTrans failed:', error)
    return null
  }
}

/** Google 翻译（整句机器翻译；默认中英互译：含中文译英，否则译中） */
export async function googleTrans(text: string, to?: string): Promise<string> {
  const target = to ?? pickTarget(text, { zh: 'zh-CN', en: 'en' })
  const url = `${GOOGLE_ENDPOINT}?client=gtx&dt=t&dt=bd&dj=1&source=input&q=${encodeURIComponent(
    text,
  )}&sl=auto&tl=${target}`

  try {
    const res = await fetch(url)
    const data: GoogleTransRes = await res.json()
    return data.sentences.map((it) => it.trans).join('')
  } catch (error) {
    console.error('[DevGo] googleTrans failed:', error)
    return ''
  }
}

/** 测试 Google 翻译连通性 */
export async function testGoogleTrans(): Promise<boolean> {
  try {
    const res = await fetch(
      `${GOOGLE_ENDPOINT}?client=gtx&dt=t&dt=bd&dj=1&source=input&q=hello&sl=auto&tl=zh-CN`,
    )
    return res.ok
  } catch (error) {
    console.error('[DevGo] testGoogleTrans failed:', error)
    return false
  }
}

/** Google 词典查词：返回按词性分组的释义（自动判断中英方向） */
export async function googleLookup(word: string): Promise<DictResult | null> {
  const target = pickTarget(word, { zh: 'zh-CN', en: 'en' })
  const url = `${GOOGLE_ENDPOINT}?client=gtx&dt=t&dt=bd&dj=1&source=input&q=${encodeURIComponent(
    word,
  )}&sl=auto&tl=${target}`

  try {
    const res = await fetch(url)
    const data: GoogleTransRes = await res.json()
    const dict = data.dict ?? []
    if (dict.length === 0) return null

    return {
      word,
      entries: dict.map((it) => ({ pos: (it.pos || '').toLowerCase(), terms: it.terms ?? [] })),
    }
  } catch (error) {
    console.error('[DevGo] googleLookup failed:', error)
    return null
  }
}
