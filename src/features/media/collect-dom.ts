/**
 * 页面 DOM 媒体资源采集：img / video / source / 链接 / preload / meta / 背景图。
 * 与 Background 的 webRequest 网络嗅探结果合并，弥补缓存命中、懒加载等网络侧看不到的资源。
 */

import { inferMediaKind, normalizeMediaUrl, normalizeMime } from '@/utils/media'
import type { MediaResourceCandidate, MediaResourceKind } from '@/utils/messaging'

const MAX_DOM_MEDIA_RESOURCES = 500
const MAX_BACKGROUND_SCAN_ELEMENTS = 1500

function parseSrcSet(srcset: string): string[] {
  return srcset
    .split(',')
    .map((item) => item.trim().split(/\s+/)[0])
    .filter(Boolean)
}

function extractCssUrls(value: string): string[] {
  const urls: string[] = []
  const pattern = /url\((['"]?)(.*?)\1\)/g
  let match = pattern.exec(value)

  while (match) {
    if (match[2]) urls.push(match[2])
    match = pattern.exec(value)
  }

  return urls
}

function addMediaCandidate(
  store: Map<string, MediaResourceCandidate>,
  value: string | null | undefined,
  kind: MediaResourceKind,
  extra: Partial<MediaResourceCandidate> = {},
) {
  if (store.size >= MAX_DOM_MEDIA_RESOURCES || !value) return

  const url = normalizeMediaUrl(value, document.baseURI)
  if (!url) return

  const id = `${kind}:${url}`
  const current = store.get(id)
  const now = Date.now()

  store.set(id, {
    ...current,
    url,
    kind,
    source: 'dom',
    pageUrl: window.location.href,
    mime: normalizeMime(extra.mime || current?.mime) || undefined,
    extension: extra.extension || current?.extension,
    fileName: extra.fileName || current?.fileName,
    thumbnailUrl: extra.thumbnailUrl || current?.thumbnailUrl,
    size: extra.size || current?.size,
    width: extra.width || current?.width,
    height: extra.height || current?.height,
    firstSeen: current?.firstSeen || now,
    lastSeen: now,
  })
}

function collectImageElement(store: Map<string, MediaResourceCandidate>, img: HTMLImageElement) {
  const width = img.naturalWidth || img.width || undefined
  const height = img.naturalHeight || img.height || undefined
  const extra = { width, height }

  addMediaCandidate(store, img.currentSrc || img.src, 'image', extra)
  parseSrcSet(img.srcset || '').forEach((url) => addMediaCandidate(store, url, 'image', extra))
}

function collectSourceElement(
  store: Map<string, MediaResourceCandidate>,
  source: HTMLSourceElement,
  extra: Partial<MediaResourceCandidate> = {},
) {
  const mime = source.type
  const kind = inferMediaKind({ url: source.src || source.srcset || '', mime })

  if (source.src && kind) {
    addMediaCandidate(store, source.src, kind, { ...extra, mime })
  }

  parseSrcSet(source.srcset || '').forEach((url) => {
    const srcsetKind = inferMediaKind({ url, mime }) || kind
    if (srcsetKind) addMediaCandidate(store, url, srcsetKind, { ...extra, mime })
  })
}

function collectVideoElement(store: Map<string, MediaResourceCandidate>, video: HTMLVideoElement) {
  const width = video.videoWidth || video.width || undefined
  const height = video.videoHeight || video.height || undefined
  const thumbnailUrl = video.poster
    ? normalizeMediaUrl(video.poster, document.baseURI) || undefined
    : undefined
  const extra = { width, height, thumbnailUrl }

  addMediaCandidate(store, video.currentSrc || video.src, 'video', extra)
  addMediaCandidate(store, video.poster, 'image')

  video.querySelectorAll<HTMLSourceElement>('source').forEach((source) => {
    collectSourceElement(store, source, extra)
  })
}

function collectLinkElement(store: Map<string, MediaResourceCandidate>, link: HTMLAnchorElement) {
  const kind = inferMediaKind({ url: link.href })
  if (!kind) return

  addMediaCandidate(store, link.href, kind, {
    fileName: link.download || undefined,
  })
}

function collectPreloadElement(store: Map<string, MediaResourceCandidate>, link: HTMLLinkElement) {
  if (link.as !== 'image' && link.as !== 'video') return
  addMediaCandidate(store, link.href, link.as, { mime: link.type })
}

function collectMetaElement(store: Map<string, MediaResourceCandidate>, meta: HTMLMetaElement) {
  const key = (meta.getAttribute('property') || meta.name || '').toLowerCase()
  const content = meta.content

  if (!content) return
  if (key.includes('image')) addMediaCandidate(store, content, 'image')
  if (key.includes('video')) addMediaCandidate(store, content, 'video')
}

function collectBackgroundImages(store: Map<string, MediaResourceCandidate>) {
  let inspected = 0

  Array.from(document.querySelectorAll<HTMLElement>('*')).some((element) => {
    if (store.size >= MAX_DOM_MEDIA_RESOURCES || inspected >= MAX_BACKGROUND_SCAN_ELEMENTS) {
      return true
    }
    inspected += 1

    extractCssUrls(getComputedStyle(element).backgroundImage).forEach((url) => {
      addMediaCandidate(store, url, 'image')
    })

    return false
  })
}

/** 收集当前页面 DOM 中可见的图片 / 视频资源（供 popup「资源」面板合并展示） */
export function collectPageMediaResources(): MediaResourceCandidate[] {
  const resources = new Map<string, MediaResourceCandidate>()

  document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    collectImageElement(resources, img)
  })

  document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    collectVideoElement(resources, video)
  })

  document.querySelectorAll<HTMLSourceElement>('picture source, source').forEach((source) => {
    collectSourceElement(resources, source)
  })

  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    collectLinkElement(resources, link)
  })

  document.querySelectorAll<HTMLLinkElement>('link[href]').forEach((link) => {
    collectPreloadElement(resources, link)
  })

  document.querySelectorAll<HTMLMetaElement>('meta[content]').forEach((meta) => {
    collectMetaElement(resources, meta)
  })

  collectBackgroundImages(resources)

  return [...resources.values()]
}
