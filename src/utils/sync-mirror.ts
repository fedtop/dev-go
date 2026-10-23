/**
 * 跨设备同步镜像（仅在 Background 中运行）。
 *
 * 设计要点（chrome.storage.sync 配额：总计 100KB、单项 8KB、每分钟 120 次 / 每小时 1800 次写入）：
 * - 本机 local 是唯一数据源，页面只读写 local；这里负责把选定的数据镜像到 sync。
 * - 每份数据序列化后按 ~7KB 分片存为 `mirror.<name>.<i>`，另存一个描述分片的 `mirror.<name>`
 *   元信息（版本、分片数、内容哈希、修改时间、设备 id），彻底避开单项 8KB 上限。
 * - 本地变更防抖合并后再写入，连续编辑待办不会触发写入频率限制；内容未变化时不写。
 * - 其他设备的更新：分片可能分批到达，必须分片齐全且哈希一致才应用到本机。
 * - 冲突（两端在上次同步后都改过）按「最后修改者胜」处理。
 * - 失败不影响本机使用，原因写入 syncStatus 供「功能」页展示。
 */

import {
  networkCustomProxyModeProfiles,
  networkGlobalProxyProfile,
  networkScenarioProxyProfile,
  quickNavCategoryLabels,
  quickNavItems,
  syncStatus,
  todoItems,
  type SyncStatus,
} from '@/utils/settings'

interface MirrorItem<T> {
  fallback: T
  getValue(): Promise<T>
  setValue(value: T): Promise<void>
  watch(callback: (value: T) => void): () => void
}

interface MirrorSpec<T = unknown> {
  /** sync 中的命名空间（稳定，勿改） */
  name: string
  item: MirrorItem<T>
}

interface MirrorMeta {
  v: 1
  /** 内容修改时间（毫秒） */
  rev: number
  device: string
  hash: string
  chunks: number
}

interface MirrorState {
  /** 上次与 sync 一致时的内容哈希 */
  hash?: string
  /** 本机最近一次修改时间（用于冲突时比较新旧） */
  localModifiedAt?: number
}

const KEY_PREFIX = 'mirror.'
const STATE_KEY = 'syncMirrorState'
const DEVICE_KEY = 'syncDeviceId'
/** 单个分片的序列化上限（留出 key 与 JSON 开销，低于 8192） */
const CHUNK_BYTES = 7000
const PUSH_DELAY = 2500
const PULL_DELAY = 800
const RETRY_DELAY = 60_000

const encoder = new TextEncoder()

/* -------------------------------- 工具 -------------------------------- */

function hashString(value: string): string {
  // FNV-1a 32 位 + 长度：只用于判断内容是否变化，不用于安全场景
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(36)}-${value.length.toString(36)}`
}

function byteSize(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length
}

/** 按序列化后的字节数切分字符串，保证每片 ≤ CHUNK_BYTES */
function splitIntoChunks(payload: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < payload.length) {
    let length = Math.min(CHUNK_BYTES, payload.length - start)
    while (length > 1 && byteSize(payload.slice(start, start + length)) > CHUNK_BYTES) {
      length = Math.floor(length * 0.75)
    }
    // 不要把代理对（emoji 等）切成两半
    const last = payload.charCodeAt(start + length - 1)
    if (last >= 0xd800 && last <= 0xdbff && start + length < payload.length) length -= 1
    chunks.push(payload.slice(start, start + length))
    start += length
  }
  return chunks.length ? chunks : ['']
}

const metaKey = (name: string) => `${KEY_PREFIX}${name}`
const chunkKey = (name: string, index: number) => `${KEY_PREFIX}${name}.${index}`

function isMirrorMeta(value: unknown): value is MirrorMeta {
  const meta = value as Partial<MirrorMeta> | null
  return (
    !!meta &&
    meta.v === 1 &&
    typeof meta.hash === 'string' &&
    typeof meta.rev === 'number' &&
    typeof meta.chunks === 'number'
  )
}

/** chrome.storage.sync 的英文报错 → 用户可读提示 */
function describeSyncError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/QUOTA_BYTES_PER_ITEM/i.test(message)) return '单项数据超过同步上限'
  if (/QUOTA_BYTES/i.test(message)) return '同步空间已满（Chrome 同步上限 100KB）'
  if (/MAX_WRITE_OPERATIONS/i.test(message)) return '同步过于频繁，稍后会自动重试'
  if (/MAX_ITEMS/i.test(message)) return '同步条目数超过上限'
  return `同步失败：${message}`
}

function isRetryableSyncError(error: unknown): boolean {
  return /MAX_WRITE_OPERATIONS/i.test(error instanceof Error ? error.message : String(error))
}

/* -------------------------------- 镜像器 -------------------------------- */

class SyncMirror {
  private readonly specs: MirrorSpec[]
  private readonly pushTimers = new Map<string, number>()
  private readonly pullTimers = new Map<string, number>()
  /** 正在把远端数据写入本机：期间的本地变更事件不应再触发上传 */
  private readonly applying = new Set<string>()
  private deviceId = ''
  private queue: Promise<void> = Promise.resolve()

  constructor(specs: MirrorSpec[]) {
    this.specs = specs
  }

  /** 注册监听（须在 Service Worker 启动的同步阶段调用，确保事件能唤醒后台） */
  listen() {
    this.specs.forEach((spec) => {
      spec.item.watch(() => {
        if (this.applying.has(spec.name)) return
        void this.onLocalChange(spec)
      })
    })

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return
      const names = new Set<string>()
      Object.keys(changes).forEach((key) => {
        if (!key.startsWith(KEY_PREFIX)) return
        names.add(key.slice(KEY_PREFIX.length).split('.')[0])
      })
      names.forEach((name) => {
        const spec = this.specs.find((item) => item.name === name)
        if (spec) this.schedule(this.pullTimers, name, PULL_DELAY, () => this.pull(spec))
      })
    })
  }

  /** 启动或手动触发：逐项比对本机与 sync，决定上传还是下载 */
  async reconcileAll(): Promise<SyncStatus> {
    await this.setStatus({ state: 'syncing' })
    let failed = false
    for (const spec of this.specs) {
      // 单项失败（如超配额）不影响其余数据同步；错误已写入状态
      if (!(await this.enqueue(() => this.reconcile(spec)))) failed = true
    }
    return failed ? syncStatus.getValue() : this.markSynced()
  }

  /* ------------------------------ 内部 ------------------------------ */

  private schedule(
    timers: Map<string, number>,
    name: string,
    delay: number,
    task: () => Promise<boolean>,
  ) {
    const existing = timers.get(name)
    if (existing) clearTimeout(existing)
    timers.set(
      name,
      setTimeout(() => {
        timers.delete(name)
        void this.enqueue(task).then((ok) => (ok ? this.markSynced() : undefined))
      }, delay) as unknown as number,
    )
  }

  /** 所有读写 sync 的操作串行执行，避免交错写入导致分片不一致 */
  private enqueue(task: () => Promise<boolean>): Promise<boolean> {
    const run = this.queue.then(task, task)
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run.catch(async (error: unknown) => {
      console.warn('[DevGo] sync mirror failed:', error)
      await this.setStatus({ state: 'error', message: describeSyncError(error) })
      return false
    })
  }

  private async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId
    const stored = (await browser.storage.local.get(DEVICE_KEY))[DEVICE_KEY]
    this.deviceId = typeof stored === 'string' && stored ? stored : crypto.randomUUID()
    if (stored !== this.deviceId) await browser.storage.local.set({ [DEVICE_KEY]: this.deviceId })
    return this.deviceId
  }

  private async readState(): Promise<Record<string, MirrorState>> {
    const stored = (await browser.storage.local.get(STATE_KEY))[STATE_KEY]
    return stored && typeof stored === 'object' ? (stored as Record<string, MirrorState>) : {}
  }

  private async updateState(name: string, patch: MirrorState) {
    const state = await this.readState()
    state[name] = { ...state[name], ...patch }
    await browser.storage.local.set({ [STATE_KEY]: state })
  }

  /** 本机数据变化：内容与上次同步一致（如应用远端数据的回声）时忽略，否则记录修改时间并防抖上传 */
  private async onLocalChange(spec: MirrorSpec) {
    const [{ hash }, state] = await Promise.all([this.serializeLocal(spec), this.readState()])
    if (state[spec.name]?.hash === hash) return
    await this.updateState(spec.name, { localModifiedAt: Date.now() })
    this.schedule(this.pushTimers, spec.name, PUSH_DELAY, () => this.push(spec))
  }

  private async serializeLocal(spec: MirrorSpec): Promise<{ payload: string; hash: string }> {
    const payload = JSON.stringify(await spec.item.getValue()) ?? 'null'
    return { payload, hash: hashString(payload) }
  }

  private async readRemote(
    name: string,
  ): Promise<{ meta: MirrorMeta | null; payload: string | null }> {
    const meta = (await browser.storage.sync.get(metaKey(name)))[metaKey(name)]
    if (!isMirrorMeta(meta)) return { meta: null, payload: null }

    const keys = Array.from({ length: meta.chunks }, (_, index) => chunkKey(name, index))
    const stored = await browser.storage.sync.get(keys)
    const parts = keys.map((key) => stored[key])
    // 分片尚未全部到达或内容与元信息不符：视为不完整，等待后续变更事件
    if (parts.some((part) => typeof part !== 'string')) return { meta, payload: null }
    const payload = parts.join('')
    return { meta, payload: hashString(payload) === meta.hash ? payload : null }
  }

  private async reconcile(spec: MirrorSpec): Promise<boolean> {
    const [local, remote, state] = await Promise.all([
      this.serializeLocal(spec),
      this.readRemote(spec.name),
      this.readState(),
    ])
    const known = state[spec.name] ?? {}

    if (!remote.meta) return this.push(spec)
    if (remote.meta.hash === local.hash) {
      await this.updateState(spec.name, { hash: local.hash })
      return true
    }
    // 远端分片不完整：先不处理，等分片到齐的变更事件
    if (remote.payload === null) return true

    const localChanged = known.hash !== local.hash
    const remoteChanged = known.hash !== remote.meta.hash
    if (localChanged && !remoteChanged) return this.push(spec)
    if (!localChanged && remoteChanged) return this.pull(spec)
    // 双方都改过：最后修改者胜
    return (known.localModifiedAt ?? 0) > remote.meta.rev ? this.push(spec) : this.pull(spec)
  }

  private async push(spec: MirrorSpec): Promise<boolean> {
    const { payload, hash } = await this.serializeLocal(spec)
    const state = (await this.readState())[spec.name] ?? {}
    const previous = (await browser.storage.sync.get(metaKey(spec.name)))[metaKey(spec.name)]
    if (isMirrorMeta(previous) && previous.hash === hash) {
      await this.updateState(spec.name, { hash })
      return true
    }

    const chunks = splitIntoChunks(payload)
    const meta: MirrorMeta = {
      v: 1,
      rev: state.localModifiedAt ?? Date.now(),
      device: await this.getDeviceId(),
      hash,
      chunks: chunks.length,
    }

    try {
      // 分片先于元信息写入：其他设备看到新元信息时分片已就绪
      await browser.storage.sync.set(
        Object.fromEntries(chunks.map((chunk, index) => [chunkKey(spec.name, index), chunk])),
      )
      await browser.storage.sync.set({ [metaKey(spec.name)]: meta })
    } catch (error) {
      if (isRetryableSyncError(error)) {
        this.schedule(this.pushTimers, spec.name, RETRY_DELAY, () => this.push(spec))
      }
      throw error
    }

    const previousChunks = isMirrorMeta(previous) ? previous.chunks : 0
    if (previousChunks > chunks.length) {
      await browser.storage.sync.remove(
        Array.from({ length: previousChunks - chunks.length }, (_, offset) =>
          chunkKey(spec.name, chunks.length + offset),
        ),
      )
    }

    await this.updateState(spec.name, { hash })
    return true
  }

  private async pull(spec: MirrorSpec): Promise<boolean> {
    // 本机有尚未上传的修改：以本机为准，等上传覆盖远端
    if (this.pushTimers.has(spec.name)) return true

    const { meta, payload } = await this.readRemote(spec.name)
    if (!meta || payload === null) return true

    const local = await this.serializeLocal(spec)
    if (local.hash === meta.hash) {
      await this.updateState(spec.name, { hash: meta.hash })
      return true
    }

    this.applying.add(spec.name)
    try {
      await spec.item.setValue(JSON.parse(payload))
    } finally {
      // storage.onChanged 在下一轮事件循环才派发，延迟移除标记以忽略这次回声
      setTimeout(() => this.applying.delete(spec.name), 0)
    }
    await this.updateState(spec.name, { hash: meta.hash, localModifiedAt: meta.rev })
    return true
  }

  private async setStatus(patch: Partial<SyncStatus>) {
    const current = await syncStatus.getValue()
    await syncStatus.setValue({ ...current, ...patch })
  }

  private async markSynced(): Promise<SyncStatus> {
    let bytesInUse: number | undefined
    try {
      bytesInUse = await browser.storage.sync.getBytesInUse(null)
    } catch {
      // Firefox 等不支持 getBytesInUse
    }
    const status: SyncStatus = { state: 'ok', lastSyncedAt: Date.now(), bytesInUse }
    await syncStatus.setValue(status)
    return status
  }
}

let mirror: SyncMirror | null = null

/**
 * 启动同步镜像：注册监听（同步执行，保证事件可唤醒 Service Worker），返回首次对账的 Promise。
 * 首次对账应在存储迁移完成后再调用 reconcile。
 */
export function startSyncMirror() {
  if (mirror) return mirror

  const specs: MirrorSpec[] = [
    { name: 'todoItems', item: todoItems as MirrorItem<unknown> },
    { name: 'quickNavItems', item: quickNavItems as MirrorItem<unknown> },
    { name: 'quickNavCategoryLabels', item: quickNavCategoryLabels as MirrorItem<unknown> },
    { name: 'networkGlobalProxyProfile', item: networkGlobalProxyProfile as MirrorItem<unknown> },
    {
      name: 'networkScenarioProxyProfile',
      item: networkScenarioProxyProfile as MirrorItem<unknown>,
    },
    {
      name: 'networkCustomProxyModeProfiles',
      item: networkCustomProxyModeProfiles as MirrorItem<unknown>,
    },
  ]

  mirror = new SyncMirror(specs)
  mirror.listen()
  return mirror
}

/** 手动「立即同步」 */
export async function syncNow(): Promise<SyncStatus> {
  if (!mirror) return syncStatus.getValue()
  return mirror.reconcileAll()
}
