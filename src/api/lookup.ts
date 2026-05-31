import { microsoftLookup, microsoftTrans } from '@/api/microsoft'
import { googleLookup, googleTrans, youdaoTrans } from '@/api/translator'
import type { LookupProvider } from '@/utils/settings'
import type { WordResult } from '@/types/word'

/** 有道查词：返回最全（音标 + 释义 + 发音 mp3） */
async function lookupYoudao(word: string): Promise<WordResult | null> {
  const res = await youdaoTrans(word)
  if (!res) return null

  return {
    query: res.query || word,
    translation: res.translation?.join('；') ?? '',
    phonetic: res.basic?.phonetic,
    entries: res.basic?.explains?.length ? [{ pos: '', terms: res.basic.explains }] : [],
    speakUrl: res.speakUrl,
    tSpeakUrl: res.tSpeakUrl,
  }
}

/** 微软查词：译文 + 词典释义（无音标/发音） */
async function lookupMicrosoft(word: string): Promise<WordResult | null> {
  const [translation, dict] = await Promise.all([microsoftTrans(word), microsoftLookup(word)])
  if (!translation && !dict) return null

  return {
    query: word,
    translation,
    entries: dict?.entries ?? [],
  }
}

/** 谷歌查词：译文 + 词典释义（无音标/发音） */
async function lookupGoogle(word: string): Promise<WordResult | null> {
  const [translation, dict] = await Promise.all([googleTrans(word), googleLookup(word)])
  if (!translation && !dict) return null

  return {
    query: word,
    translation,
    entries: dict?.entries ?? [],
  }
}

/** 按所选引擎查词，归一化为统一结构 */
export function lookupWord(word: string, provider: LookupProvider): Promise<WordResult | null> {
  switch (provider) {
    case 'microsoft':
      return lookupMicrosoft(word)
    case 'google':
      return lookupGoogle(word)
    case 'youdao':
    default:
      return lookupYoudao(word)
  }
}
