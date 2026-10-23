/**
 * 段落翻译队列：收集 → 合批 → 限并发发送 → 逐段 resolve。
 *
 * - 同一时刻进入视口的段落在 collectDelay 内合成一批（达到 batchSize 立即发送）；
 * - 相同文本复用缓存与在途请求，页面上重复的标题 / 按钮文字只翻译一次；
 * - clear() 取消所有排队与在途请求（停止翻译、切换引擎或目标语言时调用）。
 */

import { TranslateError } from '@/features/translate/errors'
import type { TranslateLangCode } from '@/features/translate/languages'
import type { TranslatePageContext } from '@/utils/messaging'

import type { TranslatePortClient } from './transport'

export interface TranslationQueueOptions {
  batchSize: number
  maxChars: number
  collectDelay: number
  concurrency: number
  cacheLimit: number
}

const DEFAULT_OPTIONS: TranslationQueueOptions = {
  batchSize: 10,
  maxChars: 4000,
  collectDelay: 150,
  concurrency: 3,
  cacheLimit: 1000,
}

interface QueueItem {
  text: string
  target: TranslateLangCode
  settled: boolean
  resolve: (text: string) => void
  reject: (error: TranslateError) => void
}

export class TranslationQueue {
  private readonly options: TranslationQueueOptions
  private readonly cache = new Map<string, string>()
  private readonly inflight = new Map<string, Promise<string>>()
  private readonly cancels = new Set<() => void>()
  private waiting: QueueItem[] = []
  private active = 0
  private timer: number | null = null

  constructor(
    private readonly client: TranslatePortClient,
    private readonly getContext: () => TranslatePageContext | undefined,
    options: Partial<TranslationQueueOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  translate(text: string, target: TranslateLangCode): Promise<string> {
    const key = `${target}\u0000${text}`
    const cached = this.cache.get(key)
    if (cached !== undefined) return Promise.resolve(cached)

    const existing = this.inflight.get(key)
    if (existing) return existing

    const promise = new Promise<string>((resolve, reject) => {
      const item: QueueItem = {
        text,
        target,
        settled: false,
        resolve: (value) => {
          if (item.settled) return
          item.settled = true
          resolve(value)
        },
        reject: (error) => {
          if (item.settled) return
          item.settled = true
          reject(error)
        },
      }
      this.waiting.push(item)
    })

    this.inflight.set(key, promise)
    promise.then(
      (value) => {
        if (this.inflight.get(key) === promise) this.inflight.delete(key)
        this.remember(key, value)
      },
      () => {
        if (this.inflight.get(key) === promise) this.inflight.delete(key)
      },
    )

    this.schedule()
    return promise
  }

  /** 取消全部排队与在途请求 */
  clear() {
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = null

    const aborted = new TranslateError('aborted', '翻译已取消')
    this.waiting.forEach((item) => item.reject(aborted))
    this.waiting = []
    this.cancels.forEach((cancel) => cancel())
    this.cancels.clear()
    this.inflight.clear()
  }

  clearCache() {
    this.cache.clear()
  }

  private remember(key: string, value: string) {
    this.cache.set(key, value)
    if (this.cache.size > this.options.cacheLimit) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
  }

  private schedule() {
    if (this.waiting.length >= this.options.batchSize) {
      this.flush()
      return
    }
    if (this.timer) return
    this.timer = window.setTimeout(() => this.flush(), this.options.collectDelay)
  }

  private flush() {
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = null

    while (this.active < this.options.concurrency && this.waiting.length) {
      void this.run(this.takeBatch())
    }
  }

  /** 取出一批：同目标语言、不超过条数与字符上限 */
  private takeBatch(): QueueItem[] {
    const [first] = this.waiting
    const batch: QueueItem[] = []
    const rest: QueueItem[] = []
    let chars = 0

    for (const item of this.waiting) {
      const fits =
        item.target === first.target &&
        batch.length < this.options.batchSize &&
        (batch.length === 0 || chars + item.text.length <= this.options.maxChars)
      if (fits) {
        batch.push(item)
        chars += item.text.length
      } else {
        rest.push(item)
      }
    }

    this.waiting = rest
    return batch
  }

  private async run(batch: QueueItem[]) {
    this.active += 1
    const { promise, cancel } = this.client.translate(
      batch.map((item, index) => ({ id: String(index), text: item.text })),
      batch[0].target,
      this.getContext(),
      {
        onSegment: (id, text) => batch[Number(id)]?.resolve(text),
        onSegmentError: (id, error) => batch[Number(id)]?.reject(error),
      },
    )
    this.cancels.add(cancel)

    try {
      await promise
      const missing = new TranslateError('parse', '翻译服务没有返回该段结果')
      batch.forEach((item) => item.reject(missing))
    } catch (error) {
      const translateError =
        error instanceof TranslateError ? error : new TranslateError('unknown', String(error))
      batch.forEach((item) => item.reject(translateError))
    } finally {
      this.cancels.delete(cancel)
      this.active -= 1
      if (this.waiting.length) this.schedule()
    }
  }
}
