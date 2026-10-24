/**
 * 媒体资源嗅探：通过 webRequest 记录各标签页加载的图片 / 视频，合并内容脚本的 DOM 采集结果，并提供下载。
 */

import type {
  MediaDownloadResult,
  MediaResource,
  MediaResourceCandidate,
  MediaResourceListResult,
} from '@/utils/messaging'
import {
  buildMediaFileName,
  buildMediaResource,
  getDirectMediaDownloadBlockReason,
  getMediaResourceId,
  getTwitterMediaKey,
  inferMediaKind,
  mergeMediaSource,
} from '@/utils/media'

const MEDIA_CACHE_LIMIT = 300
const MEDIA_DOWNLOAD_DIR = 'DevGo-Media'
const MEDIA_WEB_REQUEST_TYPES: chrome.webRequest.ResourceType[] = [
  'image',
  'media',
  'xmlhttprequest',
  'object',
  'other',
]

interface PendingMediaRequest extends MediaResourceCandidate {
  tabId: number
  requestId: string
}

const mediaResourcesByTab = new Map<number, Map<string, MediaResource>>()
const pendingMediaRequests = new Map<string, PendingMediaRequest>()

function getMediaRequestKey(tabId: number, requestId: string): string {
  return `${tabId}:${requestId}`
}

function getHeaderValue(
  headers: chrome.webRequest.HttpHeader[] | undefined,
  name: string,
): string | undefined {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value
}

function parseContentLength(value?: string): number | undefined {
  if (!value) return undefined
  const size = Number(value)
  return Number.isFinite(size) && size >= 0 ? size : undefined
}

function getWebRequestDocumentUrl(details: unknown): string | undefined {
  const documentUrl = (details as { documentUrl?: unknown }).documentUrl
  return typeof documentUrl === 'string' ? documentUrl : undefined
}

function getTabMediaStore(tabId: number): Map<string, MediaResource> {
  let store = mediaResourcesByTab.get(tabId)

  if (!store) {
    store = new Map()
    mediaResourcesByTab.set(tabId, store)
  }

  return store
}

function linkTwitterMediaThumbnail(
  store: Map<string, MediaResource>,
  resource: MediaResource,
): MediaResource {
  const key = getTwitterMediaKey(resource.url)
  if (!key) return resource

  if (resource.kind === 'image') {
    Array.from(store.values())
      .filter(
        (item) =>
          item.kind === 'video' && !item.thumbnailUrl && getTwitterMediaKey(item.url) === key,
      )
      .forEach((item) => {
        store.set(item.id, {
          ...item,
          thumbnailUrl: resource.url,
          lastSeen: Math.max(item.lastSeen, resource.lastSeen),
        })
      })

    return resource
  }

  if (resource.thumbnailUrl) return resource

  const thumbnail = [...store.values()].find(
    (item) => item.kind === 'image' && getTwitterMediaKey(item.url) === key,
  )

  if (!thumbnail) return resource

  const next: MediaResource = {
    ...resource,
    thumbnailUrl: thumbnail.url,
  }
  store.set(next.id, next)
  return next
}

function rememberMediaResource(tabId: number, candidate: MediaResourceCandidate): MediaResource {
  const store = getTabMediaStore(tabId)
  const id = getMediaResourceId(candidate.kind, candidate.url)
  const current = store.get(id)
  const now = Date.now()

  if (current) {
    const next: MediaResource = {
      ...current,
      source: mergeMediaSource(current.source, candidate.source),
      pageUrl: candidate.pageUrl || current.pageUrl,
      mime: candidate.mime || current.mime,
      extension: candidate.extension || current.extension,
      fileName: buildMediaFileName(
        candidate.url,
        candidate.kind,
        candidate.mime || current.mime,
        candidate.fileName || current.fileName,
      ),
      thumbnailUrl: candidate.thumbnailUrl || current.thumbnailUrl,
      size: candidate.size || current.size,
      width: candidate.width || current.width,
      height: candidate.height || current.height,
      firstSeen: Math.min(current.firstSeen, candidate.firstSeen || now),
      lastSeen: Math.max(current.lastSeen, candidate.lastSeen || now),
    }
    store.set(id, next)
    return linkTwitterMediaThumbnail(store, next)
  }

  const resource = buildMediaResource(tabId, candidate, now)
  store.set(id, resource)
  const linkedResource = linkTwitterMediaThumbnail(store, resource)

  if (store.size > MEDIA_CACHE_LIMIT) {
    const oldest = [...store.values()].sort((a, b) => a.lastSeen - b.lastSeen)[0]
    if (oldest) store.delete(oldest.id)
  }

  return linkedResource
}

function clearTabMediaResources(tabId: number): number {
  const removed = mediaResourcesByTab.get(tabId)?.size || 0
  mediaResourcesByTab.delete(tabId)

  Array.from(pendingMediaRequests.entries())
    .filter(([, request]) => request.tabId === tabId)
    .forEach(([key]) => pendingMediaRequests.delete(key))

  return removed
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

async function collectDomMediaResources(tabId: number): Promise<MediaResourceCandidate[]> {
  try {
    const resources = await browser.tabs.sendMessage(tabId, { type: 'collect-media-resources' })
    return Array.isArray(resources) ? resources : []
  } catch (error) {
    console.warn('[DevGo] collect DOM media failed:', error)
    return []
  }
}

export async function getMediaResources(
  tabId?: number,
  includeDom = true,
): Promise<MediaResourceListResult> {
  const targetTabId = tabId ?? (await getActiveTabId())
  if (targetTabId == null) {
    return { resources: [], error: '无法获取当前标签页' }
  }

  let pageUrl = ''
  try {
    const tab = await browser.tabs.get(targetTabId)
    pageUrl = tab.url || ''
  } catch {
    // 标签页可能已经关闭，下面仍返回缓存结果。
  }

  if (includeDom) {
    const domResources = await collectDomMediaResources(targetTabId)
    domResources.forEach((resource) => {
      rememberMediaResource(targetTabId, {
        ...resource,
        pageUrl: resource.pageUrl || pageUrl,
      })
    })
  }

  const resources = [...(mediaResourcesByTab.get(targetTabId)?.values() || [])].sort(
    (a, b) => b.lastSeen - a.lastSeen,
  )

  return {
    tabId: targetTabId,
    pageUrl,
    resources,
  }
}

export async function clearMediaResources(
  tabId?: number,
): Promise<{ ok: boolean; removed: number }> {
  const targetTabId = tabId ?? (await getActiveTabId())
  if (targetTabId == null) return { ok: false, removed: 0 }

  return {
    ok: true,
    removed: clearTabMediaResources(targetTabId),
  }
}

export async function downloadMediaResource(
  url: string,
  fileName?: string,
  mime?: string,
  saveAs = true,
): Promise<MediaDownloadResult> {
  const blockReason = getDirectMediaDownloadBlockReason(url, mime)
  if (blockReason) {
    return { ok: false, error: blockReason }
  }

  const kind = inferMediaKind({ url, mime }) || 'video'
  const filename = `${MEDIA_DOWNLOAD_DIR}/${buildMediaFileName(url, kind, mime, fileName)}`

  try {
    const downloadId = await browser.downloads.download({
      url,
      filename,
      conflictAction: 'uniquify',
      saveAs,
    })

    return { ok: true, downloadId }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function rememberMediaFromRequest(details: chrome.webRequest.WebRequestBodyDetails) {
  if (details.tabId < 0) return

  const kind = inferMediaKind({
    url: details.url,
    resourceType: details.type,
  })

  if (!kind) return

  const candidate: PendingMediaRequest = {
    tabId: details.tabId,
    requestId: details.requestId,
    url: details.url,
    kind,
    source: 'network',
    pageUrl: getWebRequestDocumentUrl(details),
    firstSeen: Date.now(),
    lastSeen: Date.now(),
  }

  pendingMediaRequests.set(getMediaRequestKey(details.tabId, details.requestId), candidate)
  rememberMediaResource(details.tabId, candidate)
}

function rememberMediaFromResponse(details: chrome.webRequest.WebResponseHeadersDetails) {
  if (details.tabId < 0) return

  const requestKey = getMediaRequestKey(details.tabId, details.requestId)
  const pending = pendingMediaRequests.get(requestKey)
  const contentType = getHeaderValue(details.responseHeaders, 'content-type')
  const contentLength = parseContentLength(
    getHeaderValue(details.responseHeaders, 'content-length'),
  )
  const kind =
    inferMediaKind({
      url: details.url,
      mime: contentType,
      resourceType: details.type,
    }) || pending?.kind

  if (!kind) {
    pendingMediaRequests.delete(requestKey)
    return
  }

  rememberMediaResource(details.tabId, {
    url: details.url,
    kind,
    source: 'network',
    pageUrl: pending?.pageUrl || getWebRequestDocumentUrl(details),
    mime: contentType || pending?.mime,
    size: contentLength || pending?.size,
    firstSeen: pending?.firstSeen,
    lastSeen: Date.now(),
  })
  pendingMediaRequests.delete(requestKey)
}

/** 注册网络嗅探与标签页生命周期监听（需在 SW 启动时同步调用） */
export function registerMediaSniffer() {
  const filter = { urls: ['<all_urls>'], types: MEDIA_WEB_REQUEST_TYPES }
  const forgetRequest = (details: { tabId: number; requestId: string }) => {
    if (details.tabId >= 0) {
      pendingMediaRequests.delete(getMediaRequestKey(details.tabId, details.requestId))
    }
  }

  chrome.webRequest?.onBeforeRequest.addListener(rememberMediaFromRequest, filter)
  chrome.webRequest?.onResponseStarted.addListener(rememberMediaFromResponse, filter, [
    'responseHeaders',
  ])
  chrome.webRequest?.onCompleted.addListener(forgetRequest, filter)
  chrome.webRequest?.onErrorOccurred.addListener(forgetRequest, filter)

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.url) {
      clearTabMediaResources(tabId)
    }
  })

  browser.tabs.onRemoved.addListener((tabId) => {
    clearTabMediaResources(tabId)
  })
}
