import type { DictResult } from '@/types/dict'

/** 统一的查词结果（popup 顶部查词框用，兼容 有道/微软/谷歌） */
export interface WordResult {
  /** 查询词 */
  query: string
  /** 机器翻译译文 */
  translation: string
  /** 音标（仅有道有） */
  phonetic?: string
  /** 词典释义（按词性分组） */
  entries: DictResult['entries']
  /** 原文发音 mp3（仅有道有） */
  speakUrl?: string
  /** 译文发音 mp3（仅有道有） */
  tSpeakUrl?: string
}
