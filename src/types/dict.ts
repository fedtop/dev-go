/** 统一的词典查询结果（微软 / 谷歌共用） */
export interface DictEntry {
  /** 词性，如 noun / verb（可能为空） */
  pos: string
  /** 该词性下的释义 / 译法列表 */
  terms: string[]
}

export interface DictResult {
  word: string
  entries: DictEntry[]
}
