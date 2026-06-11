/**
 * favicon 持久化缓存 + 渐进升级：
 *
 * 1. storage.local 里缓存过的高清网络图标 → 秒出（首选）
 * 2. 未命中 → 浏览器本地 favicon 数据库（/_favicon/，需 manifest `favicon` 权限）
 *    快速垫底（访问过的站点零网络秒出，但通常只有 32px、偏糊），
 *    同时后台并发竞速网络源抓高清图：抓到且确实更清晰 → 回调替换并落库；
 *    抓不到 → 保留垫底图。Firefox 无 /_favicon/，自动跳过直接走网络
 * 3. 网络源（站点直连 / google s2 / duckduckgo / icon.horse）并发竞速：
 *    优先取最先成功的「高清」结果（解码后宽度达标），都不达标则取尺寸最大的
 *
 * 缓存策略：
 * - 只持久化网络抓到的图标（本地数据库本来就是零成本，不落库）
 * - 成功缓存 7 天；过期后先用旧图渲染、后台静默刷新（stale-while-revalidate）
 * - 网络全部失败时写 1 天负缓存：期间跳过网络重试，但本地数据库照常可用
 * - 单图超过 150KB 不缓存；条目超过上限时按时间淘汰最旧的
 */

import { faviconUrls } from './engines'

interface FaviconCacheEntry {
  /** data URL；空串表示「网络抓取失败」负缓存 */
  dataUrl: string
  updatedAt: number
}

type FaviconCache = Record<string, FaviconCacheEntry>

// v2：v1 串行抓取时代写入的负缓存作废，直接换 key
const CACHE_KEY = 'local:faviconCacheV2'
const SUCCESS_TTL = 7 * 24 * 60 * 60 * 1000
const FAILURE_TTL = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT = 4000
const MAX_ENTRY_BYTES = 150 * 1024
const MAX_ENTRIES = 400

/** 整页只读一次 storage，所有图标共享同一份内存缓存 */
let cachePromise: Promise<FaviconCache> | null = null
function readCache(): Promise<FaviconCache> {
  cachePromise ??= storage
    .getItem<FaviconCache>(CACHE_KEY)
    .then((value) => value ?? {})
    .catch(() => ({}))
  return cachePromise
}

/** 串行化写入，避免并发 setItem 互相覆盖 */
let writeChain: Promise<unknown> = Promise.resolve()
function persist(cache: FaviconCache): void {
  writeChain = writeChain.then(() => storage.setItem(CACHE_KEY, cache)).catch(() => undefined)
}

function cacheKeyOf(url: string, size: number): string | null {
  try {
    return `${new URL(url).hostname}@${size}`
  } catch {
    return null
  }
}

async function fetchAsDataUrl(source: string): Promise<string | null> {
  const res = await fetch(source, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
  if (!res.ok) return null
  const blob = await res.blob()
  if (!blob.type.startsWith('image/') || blob.size === 0 || blob.size > MAX_ENTRY_BYTES) return null
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 解码图片取实际宽度（顺带验证是张能渲染的图），解不开返回 0 */
function imageWidth(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth)
    img.onerror = () => resolve(0)
    img.src = dataUrl
  })
}

function pruneOldest(cache: FaviconCache): void {
  const keys = Object.keys(cache)
  if (keys.length <= MAX_ENTRIES) return
  keys
    .sort((a, b) => cache[a].updatedAt - cache[b].updatedAt)
    .slice(0, keys.length - MAX_ENTRIES)
    .forEach((key) => delete cache[key])
}

/** 浏览器本地 favicon 数据库地址（Chrome 104+；Firefox 请求会直接失败并被忽略）。
 * 仅在扩展页面（newtab 等）运行，origin 即 chrome-extension://<id>；
 * 不走 browser.runtime.getURL 是因为 WXT 对其参数做了入口路径白名单类型。 */
function localFaviconUrl(url: string, size: number): string {
  return `${window.location.origin}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`
}

/** 本地数据库对未知站点会返回默认地球图标：抓一次必然未知的域名作为比对基准（按尺寸缓存） */
const defaultLocalIcons = new Map<number, Promise<string>>()
function defaultLocalIcon(size: number): Promise<string> {
  let promise = defaultLocalIcons.get(size)
  if (!promise) {
    promise = fetchAsDataUrl(localFaviconUrl('https://unknown.devgo.invalid', size))
      .then((dataUrl) => dataUrl ?? '')
      .catch(() => '')
    defaultLocalIcons.set(size, promise)
  }
  return promise
}

/** 从浏览器本地 favicon 数据库取图标；未命中（返回默认地球图标）或不支持时返回 null */
async function fetchLocalFavicon(url: string, size: number): Promise<string | null> {
  try {
    const [icon, placeholder] = await Promise.all([
      fetchAsDataUrl(localFaviconUrl(url, size)),
      defaultLocalIcon(size),
    ])
    return icon && icon !== placeholder ? icon : null
  } catch {
    return null
  }
}

interface FetchedIcon {
  dataUrl: string
  width: number
}

/**
 * 并发竞速所有网络源：最先成功且达到「高清」标准（宽度 ≥ min(size, 48)）的胜出；
 * 都不达标则取尺寸最大的；全部失败返回 null。
 */
async function raceNetworkFavicons(url: string, size: number): Promise<FetchedIcon | null> {
  const attempts = faviconUrls(url, size).map(async (source) => {
    const dataUrl = await fetchAsDataUrl(source)
    if (!dataUrl) throw new Error('no icon')
    const width = await imageWidth(dataUrl)
    if (width <= 0) throw new Error('not an image')
    return { dataUrl, width }
  })
  // 错误统一吞掉，给后面「挑最大」用
  const settled = attempts.map((attempt) => attempt.catch(() => null))

  const hiResMin = Math.min(size, 48)
  const hiRes = await Promise.any(
    attempts.map(async (attempt) => {
      const icon = await attempt
      if (icon.width < hiResMin) throw new Error('low res')
      return icon
    }),
  ).catch(() => null)
  if (hiRes) return hiRes

  const all = (await Promise.all(settled)).filter((icon): icon is FetchedIcon => icon !== null)
  if (all.length === 0) return null
  return all.reduce((best, cur) => (cur.width > best.width ? cur : best))
}

/** 同 host 并发请求去重（同一站点出现在多个分类 / 搜索建议时只抓一次） */
const inflight = new Map<string, Promise<string>>()

/** 网络抓取并落库；失败时保留已有旧图（只顺延时间戳），否则写负缓存 */
function fetchNetworkAndStore(key: string, url: string, size: number): Promise<string> {
  const running = inflight.get(key)
  if (running) return running

  const task = (async () => {
    const fetched = await raceNetworkFavicons(url, size)
    const cache = await readCache()
    const dataUrl = fetched?.dataUrl ?? cache[key]?.dataUrl ?? ''
    cache[key] = { dataUrl, updatedAt: Date.now() }
    pruneOldest(cache)
    persist(cache)
    return dataUrl
  })()

  inflight.set(key, task)
  task.finally(() => inflight.delete(key)).catch(() => undefined)
  return task
}

/**
 * 取站点图标的 data URL，渐进式：
 * 返回值是当下能拿到的最快结果；若后台随后抓到了更清晰的网络图标，
 * 通过 onUpgrade 回调推送给调用方替换。返回空串表示拿不到图标（降级为文字头像）。
 */
export async function loadFavicon(
  url: string,
  size: number,
  onUpgrade?: (dataUrl: string) => void,
): Promise<string> {
  const key = cacheKeyOf(url, size)
  if (!key) return ''

  const cache = await readCache()
  const entry = cache[key]
  const fresh = entry
    ? Date.now() - entry.updatedAt < (entry.dataUrl ? SUCCESS_TTL : FAILURE_TTL)
    : false

  // 已有缓存的网络图标：直接用；过期就后台刷新，刷出新图再推送替换
  if (entry?.dataUrl) {
    if (!fresh) {
      fetchNetworkAndStore(key, url, size).then((next) => {
        if (next && next !== entry.dataUrl) onUpgrade?.(next)
      })
    }
    return entry.dataUrl
  }

  // 负缓存生效期内跳过网络重试；本地数据库不受影响（用户可能刚访问过该站点）
  const networkAllowed = !fresh

  // 本地 favicon 数据库快速垫底，后台抓到更清晰的再替换
  const local = await fetchLocalFavicon(url, size)
  if (local) {
    if (networkAllowed) {
      fetchNetworkAndStore(key, url, size).then((hi) => {
        if (hi && hi !== local) onUpgrade?.(hi)
      })
    }
    return local
  }

  if (!networkAllowed) return ''
  return fetchNetworkAndStore(key, url, size)
}
