/**
 * Background 翻译服务：统一调度微软 / Google / AI 大模型三种引擎。
 *
 * - 输入为「纯文本 + <bN> 行内标记」格式的段落数组，按段回调结果（成功或错误），
 *   内容脚本据此实现「哪段先好先显示」的流式回填。
 * - LRU 缓存命中的段落立即回调；未命中的按引擎特性分块、限并发请求。
 * - AI 翻译使用 <seg id="N"> 包裹每段，流式解析，任意一段闭合即推送。
 */

import { completeChat, streamChatCompletion, type ChatMessage } from '@/api/llm'
import { MICROSOFT_BATCH_SIZE, microsoftTranslate } from '@/api/microsoft'
import { googleTranslateBatch } from '@/api/translator'
import { toTranslateError, TranslateError } from '@/features/translate/errors'
import {
  toGoogleLang,
  toLlmLanguageName,
  toMicrosoftLang,
  type TranslateLangCode,
} from '@/features/translate/languages'
import { DEFAULT_LLM_CONFIG, isLlmConfig, type LlmConfig } from '@/features/translate/llm-config'
import { stripMarkers } from '@/features/translate/markers'
import type { TranslatePageContext } from '@/utils/messaging'
import {
  isTranslateProvider,
  translateLlmApiKey,
  translateLlmConfig,
  translateProvider,
  type TranslateProvider,
} from '@/utils/settings'

export type SegmentResult = { text: string } | { error: TranslateError }

export interface TranslateJob {
  texts: string[]
  target: TranslateLangCode
  context?: TranslatePageContext
  signal?: AbortSignal
  onResult: (index: number, result: SegmentResult) => void
}

export interface ProviderSettings {
  provider: TranslateProvider
  llm: LlmConfig
  apiKey: string
}

const CACHE_LIMIT = 2000
const MICROSOFT_MAX_CHARS = 8000
/** Google 表单请求体积有限，分块更保守 */
const GOOGLE_MAX_SEGMENTS = 20
const GOOGLE_MAX_CHARS = 4500
const LLM_MAX_SEGMENTS = 16
const LLM_MAX_CHARS = 3500

/* -------------------------------- 工具 -------------------------------- */

function createLimiter(concurrency: number) {
  let active = 0
  const waiting: Array<() => void> = []

  const next = () => {
    if (active >= concurrency) return
    const resume = waiting.shift()
    if (!resume) return
    active += 1
    resume()
  }

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      waiting.push(resolve)
      next()
    })
    try {
      return await task()
    } finally {
      active -= 1
      next()
    }
  }
}

const limiters: Record<TranslateProvider, ReturnType<typeof createLimiter>> = {
  microsoft: createLimiter(4),
  google: createLimiter(4),
  llm: createLimiter(3),
}

/** 按条数与总字符数切块，保持原顺序 */
function chunkIndexes(texts: string[], maxItems: number, maxChars: number): number[][] {
  const chunks: number[][] = []
  let current: number[] = []
  let chars = 0

  texts.forEach((text, index) => {
    if (current.length && (current.length >= maxItems || chars + text.length > maxChars)) {
      chunks.push(current)
      current = []
      chars = 0
    }
    current.push(index)
    chars += text.length
  })

  if (current.length) chunks.push(current)
  return chunks
}

function hashString(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new TranslateError('aborted', '翻译已取消')
}

/* -------------------------------- 缓存 -------------------------------- */

const cache = new Map<string, string>()

function getProviderCacheKey(settings: ProviderSettings): string {
  if (settings.provider !== 'llm') return settings.provider
  const { baseUrl, model, prompt } = settings.llm
  return `llm:${baseUrl.trim()}:${model.trim()}:${hashString(prompt)}`
}

function readCache(key: string): string | undefined {
  const value = cache.get(key)
  if (value === undefined) return undefined
  cache.delete(key)
  cache.set(key, value)
  return value
}

function writeCache(key: string, value: string) {
  if (!value.trim()) return
  cache.set(key, value)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

/* ------------------------------ 各引擎适配 ------------------------------ */

type ProviderRunner = (
  texts: string[],
  job: Omit<TranslateJob, 'texts'>,
  settings: ProviderSettings,
) => Promise<void>

/**
 * 机器翻译通用批处理：按条数 / 字符数分块、限并发请求，每块完成即回调。
 * 微软与 Google 的免费接口都支持一次翻译多段，且纯文本模式下会原样保留 <bN> 标记。
 */
function createBatchRunner(options: {
  limiter: ReturnType<typeof createLimiter>
  maxItems: number
  maxChars: number
  request: (texts: string[], target: TranslateLangCode, signal?: AbortSignal) => Promise<string[]>
}): ProviderRunner {
  return async (texts, job) => {
    const chunks = chunkIndexes(texts, options.maxItems, options.maxChars)

    await Promise.all(
      chunks.map((indexes) =>
        options.limiter(async () => {
          throwIfAborted(job.signal)
          try {
            const translated = await options.request(
              indexes.map((index) => texts[index]),
              job.target,
              job.signal,
            )
            indexes.forEach((index, offset) => {
              job.onResult(index, { text: translated[offset] ?? '' })
            })
          } catch (error) {
            const translateError = toTranslateError(error)
            indexes.forEach((index) => job.onResult(index, { error: translateError }))
          }
        }),
      ),
    )
  }
}

const runMicrosoft = createBatchRunner({
  limiter: limiters.microsoft,
  maxItems: MICROSOFT_BATCH_SIZE,
  maxChars: MICROSOFT_MAX_CHARS,
  request: (texts, target, signal) =>
    microsoftTranslate(texts, toMicrosoftLang(target), { signal }),
})

const runGoogle = createBatchRunner({
  limiter: limiters.google,
  maxItems: GOOGLE_MAX_SEGMENTS,
  maxChars: GOOGLE_MAX_CHARS,
  request: (texts, target, signal) => googleTranslateBatch(texts, toGoogleLang(target), signal),
})

function buildLlmSystemPrompt(target: TranslateLangCode, customPrompt: string): string {
  const language = toLlmLanguageName(target)
  const rules = [
    `You are a professional translation engine. Translate every segment the user sends into ${language}.`,
    'Rules:',
    '1. Each input segment is wrapped like <seg id="N">...</seg>. Output every translated segment wrapped in the same tag with the same id, in the same order, one per line. Output nothing else: no explanations, no notes, no code fences.',
    '2. Tags like <b0>...</b0> are inline formatting placeholders. Keep every placeholder tag with the same number around the corresponding translated words. Never add, remove or renumber them.',
    '3. Keep code, commands, identifiers, URLs, file paths, version numbers and brand names unchanged.',
    `4. If a segment is already in ${language} or has nothing to translate, output it unchanged.`,
    '5. Translate faithfully, naturally and fluently, following the conventions and punctuation of the target language. Keep the terminology consistent across segments.',
  ]
  if (customPrompt.trim()) rules.push('', 'Additional requirements:', customPrompt.trim())
  return rules.join('\n')
}

function buildLlmUserPrompt(texts: string[], context?: TranslatePageContext): string {
  const segments = texts.map((text, index) => `<seg id="${index}">${text}</seg>`).join('\n')
  const contextLine = context?.title
    ? `Context: these segments come from the web page "${context.title}"${
        context.host ? ` (${context.host})` : ''
      }.\n\n`
    : ''
  return `${contextLine}${segments}`
}

const SEG_PATTERN = /<seg\s+id\s*=\s*["']?(\d+)["']?\s*>([\s\S]*?)<\/seg\s*>/gi

/** 去掉推理模型输出在正文里的 <think> 段；未闭合时截断到 <think> 之前 */
function stripThinking(output: string): string {
  const withoutClosed = output.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const openIndex = withoutClosed.search(/<think>/i)
  return openIndex >= 0 ? withoutClosed.slice(0, openIndex) : withoutClosed
}

/** 增量解析模型输出，<seg> 闭合即回调；同一 id 只回调一次 */
class SegmentStreamParser {
  private output = ''
  private readonly emitted = new Set<number>()

  constructor(private readonly onSegment: (id: number, text: string) => void) {}

  feed(delta: string) {
    this.output += delta
    if (!delta.includes('>')) return
    this.scan()
  }

  get emittedCount(): number {
    return this.emitted.size
  }

  has(id: number): boolean {
    return this.emitted.has(id)
  }

  /** 输出结束后的整段文本（去掉推理内容与代码围栏），用于单段兜底 */
  get finalText(): string {
    return stripThinking(this.output)
      .replace(/^\s*```[a-z]*\s*\n?|\n?```\s*$/gi, '')
      .trim()
  }

  private scan() {
    for (const match of stripThinking(this.output).matchAll(SEG_PATTERN)) {
      const id = Number(match[1])
      if (this.emitted.has(id)) continue
      this.emitted.add(id)
      this.onSegment(id, match[2].trim())
    }
  }
}

const runLlm: ProviderRunner = async (texts, job, settings) => {
  const chunks = chunkIndexes(texts, LLM_MAX_SEGMENTS, LLM_MAX_CHARS)
  const systemPrompt = buildLlmSystemPrompt(job.target, settings.llm.prompt)

  await Promise.all(
    chunks.map((indexes) =>
      limiters.llm(async () => {
        throwIfAborted(job.signal)
        const chunkTexts = indexes.map((index) => texts[index])
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildLlmUserPrompt(chunkTexts, job.context) },
        ]
        const parser = new SegmentStreamParser((localId, text) => {
          const index = indexes[localId]
          if (index !== undefined) job.onResult(index, { text })
        })

        try {
          for await (const delta of streamChatCompletion({
            config: settings.llm,
            apiKey: settings.apiKey,
            messages,
            signal: job.signal,
          })) {
            parser.feed(delta)
          }
        } catch (error) {
          const translateError = toTranslateError(error)
          indexes.forEach((index, localId) => {
            if (!parser.has(localId)) job.onResult(index, { error: translateError })
          })
          return
        }

        // 只有一段且模型没按格式包裹时，把整段输出当作译文
        if (indexes.length === 1 && parser.emittedCount === 0 && parser.finalText) {
          job.onResult(indexes[0], { text: parser.finalText })
          return
        }

        const missing = new TranslateError('parse', 'AI 未返回该段译文')
        indexes.forEach((index, localId) => {
          if (!parser.has(localId)) job.onResult(index, { error: missing })
        })
      }),
    ),
  )
}

const RUNNERS: Record<TranslateProvider, ProviderRunner> = {
  microsoft: runMicrosoft,
  google: runGoogle,
  llm: runLlm,
}

/* -------------------------------- 对外 API -------------------------------- */

export async function readProviderSettings(): Promise<ProviderSettings> {
  const [provider, llm, apiKey] = await Promise.all([
    translateProvider.getValue(),
    translateLlmConfig.getValue(),
    translateLlmApiKey.getValue(),
  ])
  // 备份导入或旧版本数据可能不合法，统一兜底
  return {
    provider: isTranslateProvider(provider) ? provider : 'microsoft',
    llm: isLlmConfig(llm) ? llm : DEFAULT_LLM_CONFIG,
    apiKey: typeof apiKey === 'string' ? apiKey : '',
  }
}

/** 执行一批段落翻译：每段结束（含缓存命中）都会回调一次 onResult */
export async function runTranslateJob(job: TranslateJob, settings?: ProviderSettings) {
  const resolved = settings ?? (await readProviderSettings())
  const providerKey = getProviderCacheKey(resolved)
  const pendingTexts: string[] = []
  const pendingIndexes: number[] = []

  job.texts.forEach((text, index) => {
    if (!stripMarkers(text).trim()) {
      job.onResult(index, { text: '' })
      return
    }
    const cached = readCache(`${providerKey}\u0000${job.target}\u0000${text}`)
    if (cached !== undefined) {
      job.onResult(index, { text: cached })
      return
    }
    pendingTexts.push(text)
    pendingIndexes.push(index)
  })

  if (pendingTexts.length === 0) return

  await RUNNERS[resolved.provider](
    pendingTexts,
    {
      ...job,
      onResult: (localIndex, result) => {
        const index = pendingIndexes[localIndex]
        if ('text' in result) {
          writeCache(
            `${providerKey}\u0000${job.target}\u0000${pendingTexts[localIndex]}`,
            result.text,
          )
        }
        job.onResult(index, result)
      },
    },
    resolved,
  )
}

/** 翻译单段纯文本（划词翻译 / 连通性测试），失败抛 TranslateError */
export async function translateSingleText(
  text: string,
  target: TranslateLangCode,
  settings?: ProviderSettings,
): Promise<string> {
  let result: SegmentResult | undefined
  await runTranslateJob(
    {
      texts: [text],
      target,
      onResult: (_index, segmentResult) => {
        result = segmentResult
      },
    },
    settings,
  )

  if (!result) throw new TranslateError('unknown', '翻译服务没有返回结果')
  if ('error' in result) throw result.error
  return stripMarkers(result.text).trim()
}

/** 测试引擎连通性（可传入未保存的配置） */
export async function testTranslateSettings(settings: ProviderSettings): Promise<string> {
  if (settings.provider === 'llm') {
    // 直接请求一次，绕过缓存，确保验证的是当前配置
    const output = await completeChat({
      config: settings.llm,
      apiKey: settings.apiKey,
      messages: [
        { role: 'system', content: buildLlmSystemPrompt('zh-CN', settings.llm.prompt) },
        { role: 'user', content: buildLlmUserPrompt(['Hello, world!']) },
      ],
    })
    return stripThinking(output).replace(SEG_PATTERN, '$2').trim()
  }
  return translateSingleText('Hello, world!', 'zh-CN', settings)
}
