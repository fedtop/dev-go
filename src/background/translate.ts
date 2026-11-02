/**
 * 翻译相关的 runtime 消息处理：划词翻译、连通性测试、模型列表、查词。整页翻译走长连接，见 features/translate/port-server.ts。
 */

import { completeChat, listModels } from '@/api/llm'
import { microsoftLookup } from '@/api/microsoft'
import { googleLookup } from '@/api/translator'
import { toTranslateError } from '@/features/translate/errors'
import { isLikelyInTargetLang, resolveTargetLang } from '@/features/translate/languages'
import {
  readProviderSettings,
  testTranslateSettings,
  translateSingleText,
} from '@/features/translate/service'
import type { DictResult } from '@/types/dict'
import type { WordResult } from '@/types/word'
import type {
  AiLookupResult,
  LlmModelListResult,
  TranslateTestRequest,
  TranslateTestResult,
  TranslateTextResult,
} from '@/utils/messaging'
import { translateProvider, translateTargetLang } from '@/utils/settings'

/** 划词翻译：按目标语言设置翻译；选中文本已是目标语言时自动反向（中⇄英） */
export async function translateSelectionText(text: string): Promise<TranslateTextResult> {
  const source = text.trim()
  if (!source) return { text: '' }

  let target = resolveTargetLang(await translateTargetLang.getValue(), source)
  if (isLikelyInTargetLang(source, target)) target = target === 'en' ? 'zh-CN' : 'en'

  try {
    return { text: await translateSingleText(source, target) }
  } catch (error) {
    const translateError = toTranslateError(error)
    console.warn('[DevGo] translate selection failed:', translateError)
    return { text: '', error: translateError.toJSON() }
  }
}

/** 测试翻译引擎；未传入的字段使用已保存的设置 */
export async function testTranslate(request: TranslateTestRequest): Promise<TranslateTestResult> {
  const saved = await readProviderSettings()
  try {
    const sample = await testTranslateSettings({
      provider: request.provider ?? saved.provider,
      llm: request.llm ?? saved.llm,
      apiKey: request.apiKey ?? saved.apiKey,
    })
    return sample
      ? { ok: true, sample }
      : { ok: false, error: { code: 'parse', message: '服务返回了空结果' } }
  } catch (error) {
    return { ok: false, error: toTranslateError(error).toJSON() }
  }
}

/** 拉取 AI 服务的模型列表（选项表单的模型下拉用） */
export async function listLlmModels(baseUrl: string, apiKey: string): Promise<LlmModelListResult> {
  try {
    return { models: await listModels(baseUrl, apiKey) }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { models: [], error: { code: 'timeout', message: '请求超时' } }
    }
    const { code, message } = toTranslateError(error)
    return { models: [], error: { code, message } }
  }
}

/** 按当前所选引擎查词典（AI 翻译没有词典能力，回落到微软） */
export async function lookupWord(word: string): Promise<DictResult | null> {
  const provider = await translateProvider.getValue()
  return provider === 'google' ? googleLookup(word) : microsoftLookup(word)
}

const AI_LOOKUP_TIMEOUT_MS = 30_000

const AI_LOOKUP_PROMPT = `你是词典与翻译助手。用户输入中文时译成英文，输入其他语言时译成简体中文。
只输出一个 JSON 对象，不要输出任何其他内容：
{"translation": "最常用的译文", "phonetic": "音标（仅单个英文单词时给出，如 ˈæpl，不带斜杠；否则省略）", "entries": [{"pos": "词性缩写，如 n. / v. / adj.", "terms": ["释义1", "释义2"]}]}
输入是短语或句子时 entries 为空数组，只给 translation。`

interface AiLookupPayload {
  translation?: unknown
  phonetic?: unknown
  entries?: Array<{ pos?: unknown; terms?: unknown }>
}

/** 从模型输出里取出 JSON（兼容代码块包裹、前后多余文字）；解析失败时整段作为译文 */
function parseAiLookup(query: string, output: string): WordResult {
  const json = output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1)
  try {
    const payload = JSON.parse(json) as AiLookupPayload
    const entries = Array.isArray(payload.entries)
      ? payload.entries
          .map((entry) => ({
            pos: typeof entry.pos === 'string' ? entry.pos.replace(/\.$/, '') : '',
            terms: Array.isArray(entry.terms) ? entry.terms.map(String).filter(Boolean) : [],
          }))
          .filter((entry) => entry.terms.length)
      : []
    return {
      query,
      translation: typeof payload.translation === 'string' ? payload.translation : '',
      phonetic:
        typeof payload.phonetic === 'string' && payload.phonetic.trim()
          ? payload.phonetic.trim().replace(/^\/|\/$/g, '')
          : undefined,
      entries,
    }
  } catch {
    return { query, translation: output.trim(), entries: [] }
  }
}

/** popup 查词框的 AI 引擎：使用翻译模型（追求速度），单词给出音标与按词性的释义 */
export async function aiLookup(text: string): Promise<AiLookupResult> {
  const query = text.trim()
  if (!query) return { result: null }
  const { llm, apiKey } = await readProviderSettings()
  try {
    const output = await completeChat({
      config: { ...llm, prompt: '' },
      apiKey,
      signal: AbortSignal.timeout(AI_LOOKUP_TIMEOUT_MS),
      messages: [
        { role: 'system', content: AI_LOOKUP_PROMPT },
        { role: 'user', content: query },
      ],
    })
    return { result: parseAiLookup(query, output) }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { result: null, error: { code: 'network', message: '请求超时' } }
    }
    return { result: null, error: toTranslateError(error).toJSON() }
  }
}
