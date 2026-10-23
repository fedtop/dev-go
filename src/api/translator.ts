import { httpStatusToError, TranslateError } from '@/features/translate/errors'
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

/** 查词（含词典释义 dt=bd） */
const GOOGLE_ENDPOINT = 'https://translate.google.com/translate_a/single'
/** 批量翻译：表单里放多个 q，一次请求翻译多段；纯文本模式原样保留 <bN> 占位标记 */
const GOOGLE_BATCH_ENDPOINT = 'https://translate.googleapis.com/translate_a/t'

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

/**
 * Google 批量翻译（单次请求，调用方负责分块）。失败抛 TranslateError。
 * 返回格式：sl=auto 时每项为 [译文, 源语言]，指定 sl 时每项为译文字符串。
 */
export async function googleTranslateBatch(
  texts: string[],
  target: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (texts.length === 0) return []

  const params = new URLSearchParams({ client: 'gtx', dt: 't', sl: 'auto', tl: target })
  const body = new URLSearchParams()
  texts.forEach((text) => body.append('q', text))

  const res = await fetch(`${GOOGLE_BATCH_ENDPOINT}?${params.toString()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
    credentials: 'omit',
    signal,
  })
  if (!res.ok) throw httpStatusToError(res.status, 'Google 翻译')

  const data: unknown = await res.json()
  // 只有一段时部分版本会返回扁平的 [译文, 源语言]
  const items =
    texts.length === 1 && Array.isArray(data) && typeof data[0] === 'string' ? [data] : data
  if (!Array.isArray(items) || items.length !== texts.length) {
    throw new TranslateError('parse', 'Google 翻译返回的结果数量与请求不一致')
  }
  return items.map((item) => {
    const text = Array.isArray(item) ? item[0] : item
    return typeof text === 'string' ? text : ''
  })
}

/** Google 翻译单段文本；失败抛 TranslateError */
export async function googleTranslate(
  text: string,
  target: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!text.trim()) return ''
  const [result] = await googleTranslateBatch([text], target, signal)
  return result ?? ''
}

/** Google 翻译（整句机器翻译；默认中英互译：含中文译英，否则译中；失败返回空串） */
export async function googleTrans(text: string, to?: string): Promise<string> {
  const target = to ?? pickTarget(text, { zh: 'zh-CN', en: 'en' })
  try {
    return await googleTranslate(text, target)
  } catch (error) {
    console.error('[DevGo] googleTrans failed:', error)
    return ''
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
