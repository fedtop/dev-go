/**
 * 翻译相关的 runtime 消息处理：划词翻译、连通性测试、模型列表、查词。整页翻译走长连接，见 features/translate/port-server.ts。
 */

import { listModels } from '@/api/llm'
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
import type {
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
