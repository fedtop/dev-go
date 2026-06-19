import { microsoftLookup, microsoftTransList, testMicrosoftTrans } from '@/api/microsoft'
import { googleLookup, googleTransList, testGoogleTrans } from '@/api/translator'
import { updateNetworkActionIconSafely } from '@/utils/actionIcon'
import { restoreDevBackupIfNeeded } from '@/utils/dev-backup'
import { pickTarget } from '@/utils/lang'
import {
  type NetworkRuleListDownloadStatus,
  type NetworkProxyStatus,
  sendTabMessage,
  type CorsProxyRequest,
  type CorsProxyResponse,
  type MediaDownloadResult,
  type MediaResource,
  type MediaResourceCandidate,
  type MediaResourceListResult,
  type RuntimeMessage,
} from '@/utils/messaging'
import {
  buildMediaResource,
  buildMediaFileName,
  getMediaResourceId,
  getTwitterMediaKey,
  inferMediaKind,
  isDownloadableMediaUrl,
  mergeMediaSource,
} from '@/utils/media'
import {
  buildNetworkPacScript,
  decodeNetworkRuleListText,
  normalizeNetworkProxyProfile,
  parseNetworkRuleList,
} from '@/utils/network'
import {
  enableCorsBypass,
  popupInitialTab,
  getNetworkProxyProfile,
  migrateLocalToSync,
  networkMode,
  networkProxyBypassList,
  networkProxyManaged,
  networkProxyProfile,
  networkRuleList,
  translateProvider,
  type NetworkMode,
  type NetworkProxyProfile,
  type NetworkRuleListConfig,
  type TranslateProvider,
} from '@/utils/settings'
import type { DictResult } from '@/types/dict'

const CORS_BYPASS_RULE_ID = 9001
const MS_AUTH_UA_RULE_ID = 9002
const MS_TRANSLATE_UA_RULE_ID = 9003
const EDGE_TRANSLATE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
const TRANSLATION_CACHE_LIMIT = 800
const CORS_RULE_RESOURCE_TYPES = [
  chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
  chrome.declarativeNetRequest.ResourceType.OTHER,
]
const CORS_ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
  'PROPFIND',
  'PROPPATCH',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
].join(', ')
const CORS_ALLOWED_HEADERS = [
  'Accept',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Language',
  'Content-Type',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Unmodified-Since',
  'Origin',
  'Pragma',
  'Range',
  'X-Api-Key',
  'X-Auth-Token',
  'X-Client-Version',
  'X-CSRF-Token',
  'X-HTTP-Method-Override',
  'X-Requested-With',
  'X-Test-Header',
  'X-XSRF-Token',
  '*',
].join(', ')
const MEDIA_CACHE_LIMIT = 300
const MEDIA_DOWNLOAD_DIR = 'DevGo-Media'
const MEDIA_WEB_REQUEST_TYPES: chrome.webRequest.ResourceType[] = [
  'image',
  'media',
  'xmlhttprequest',
  'object',
  'other',
]

const CORS_BYPASS_RULE: chrome.declarativeNetRequest.Rule = {
  id: CORS_BYPASS_RULE_ID,
  priority: 1,
  action: {
    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
    responseHeaders: [
      {
        header: 'Access-Control-Allow-Origin',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: '*',
      },
      {
        header: 'Access-Control-Allow-Methods',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: CORS_ALLOWED_METHODS,
      },
      {
        header: 'Access-Control-Allow-Headers',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: CORS_ALLOWED_HEADERS,
      },
      {
        header: 'Access-Control-Allow-Credentials',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: 'true',
      },
      {
        header: 'Access-Control-Expose-Headers',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: '*',
      },
      {
        header: 'Access-Control-Max-Age',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: '86400',
      },
      {
        header: 'Access-Control-Allow-Private-Network',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: 'true',
      },
      {
        header: 'Cross-Origin-Resource-Policy',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: 'cross-origin',
      },
    ],
  },
  condition: {
    urlFilter: '|http',
    resourceTypes: CORS_RULE_RESOURCE_TYPES,
  },
}

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

async function getMediaResources(
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

async function clearMediaResources(tabId?: number): Promise<{ ok: boolean; removed: number }> {
  const targetTabId = tabId ?? (await getActiveTabId())
  if (targetTabId == null) return { ok: false, removed: 0 }

  return {
    ok: true,
    removed: clearTabMediaResources(targetTabId),
  }
}

async function downloadMediaResource(
  url: string,
  fileName?: string,
  saveAs = true,
): Promise<MediaDownloadResult> {
  if (!isDownloadableMediaUrl(url)) {
    return { ok: false, error: '仅支持 http/https 资源下载' }
  }

  const kind = inferMediaKind({ url }) || 'video'
  const filename = `${MEDIA_DOWNLOAD_DIR}/${buildMediaFileName(url, kind, undefined, fileName)}`

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

function buildMicrosoftRequestRules(): chrome.declarativeNetRequest.Rule[] {
  const initiatorDomains = chrome.runtime.id ? [chrome.runtime.id] : undefined
  const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
    {
      header: 'User-Agent',
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: EDGE_TRANSLATE_UA,
    },
  ]

  return [
    {
      id: MS_AUTH_UA_RULE_ID,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders,
      },
      condition: {
        urlFilter: 'https://edge.microsoft.com/translate/auth',
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
        initiatorDomains,
      },
    },
    {
      id: MS_TRANSLATE_UA_RULE_ID,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders,
      },
      condition: {
        urlFilter: 'https://api-edge.cognitive.microsofttranslator.com/translate',
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
        initiatorDomains,
      },
    },
  ]
}

async function syncMicrosoftRequestRules(): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [MS_AUTH_UA_RULE_ID, MS_TRANSLATE_UA_RULE_ID],
    addRules: buildMicrosoftRequestRules(),
  })
}

function syncMicrosoftRequestRulesSafely() {
  syncMicrosoftRequestRules().catch((error) => {
    console.warn('[DevGo] sync Microsoft request rules failed:', error)
  })
}

/** 按开关状态安装 / 移除 CORS 动态规则。 */
async function syncCorsBypassRules(): Promise<boolean> {
  const enabled = await enableCorsBypass.getValue()

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [CORS_BYPASS_RULE_ID],
    addRules: enabled ? [CORS_BYPASS_RULE] : [],
  })

  return enabled
}

function syncCorsBypassRulesSafely() {
  syncCorsBypassRules().catch((error) => {
    console.warn('[DevGo] sync CORS bypass rules failed:', error)
  })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}

function getProxyApiError(): string {
  return '当前浏览器不支持 chrome.proxy API，或扩展未授予 proxy 权限'
}

function getProxySettings(): chrome.types.ChromeSetting {
  if (!chrome.proxy?.settings) {
    throw new Error(getProxyApiError())
  }

  return chrome.proxy.settings
}

function chromeLastError(): Error | null {
  const message = chrome.runtime.lastError?.message
  return message ? new Error(message) : null
}

function setChromeProxyConfig(config: chrome.proxy.ProxyConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    getProxySettings().set({ value: config, scope: 'regular' }, () => {
      const error = chromeLastError()
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function getChromeProxyConfig(): Promise<chrome.types.ChromeSettingGetResultDetails> {
  return new Promise((resolve, reject) => {
    getProxySettings().get({ incognito: false }, (details) => {
      const error = chromeLastError()
      if (error) {
        reject(error)
        return
      }
      resolve(details)
    })
  })
}

function buildScenarioProxyConfig(profile: NetworkProxyProfile): chrome.proxy.ProxyConfig {
  const normalized = normalizeNetworkProxyProfile(profile)

  return {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: normalized.scheme,
        host: normalized.host,
        port: normalized.port,
      },
      bypassList: normalized.bypassList,
    },
  }
}

function buildNetworkProxyConfig(
  mode: NetworkMode,
  profile: NetworkProxyProfile,
  ruleList: NetworkRuleListConfig,
): chrome.proxy.ProxyConfig {
  if (mode === 'direct') {
    return { mode: 'direct' }
  }

  if (mode === 'system') {
    return { mode: 'system' }
  }

  if (mode === 'global') {
    return buildScenarioProxyConfig(profile)
  }

  if (ruleList.enabled && ruleList.text.trim()) {
    const pacScript = buildNetworkPacScript(profile, ruleList.text)

    return {
      mode: 'pac_script',
      pacScript: {
        data: pacScript.data,
        mandatory: false,
      },
    }
  }

  return buildScenarioProxyConfig(profile)
}

async function getNetworkStatus(error?: unknown): Promise<NetworkProxyStatus> {
  const [mode, managed] = await Promise.all([
    networkMode.getValue(),
    networkProxyManaged.getValue(),
  ])

  if (error) {
    return {
      ok: false,
      mode,
      managed,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  try {
    const details = await getChromeProxyConfig()
    return {
      ok: true,
      mode,
      managed,
      levelOfControl: details.levelOfControl,
    }
  } catch (statusError) {
    return {
      ok: false,
      mode,
      managed,
      error: statusError instanceof Error ? statusError.message : String(statusError),
    }
  }
}

async function applyNetworkMode(mode: NetworkMode): Promise<NetworkProxyStatus> {
  await networkMode.setValue(mode)
  await networkProxyManaged.setValue(true)

  try {
    const [profile, ruleList] = await Promise.all([
      getNetworkProxyProfile(),
      networkRuleList.getValue(),
    ])
    await setChromeProxyConfig(buildNetworkProxyConfig(mode, profile, ruleList))
    return getNetworkStatus()
  } catch (error) {
    return getNetworkStatus(error)
  }
}

async function syncNetworkProxy(): Promise<NetworkProxyStatus> {
  const managed = await networkProxyManaged.getValue()

  if (!managed) {
    return getNetworkStatus()
  }

  try {
    const [mode, profile, ruleList] = await Promise.all([
      networkMode.getValue(),
      getNetworkProxyProfile(),
      networkRuleList.getValue(),
    ])
    await setChromeProxyConfig(buildNetworkProxyConfig(mode, profile, ruleList))
    return getNetworkStatus()
  } catch (error) {
    return getNetworkStatus(error)
  }
}

async function migrateThenSyncNetworkProxy(): Promise<void> {
  await migrateLocalToSync()
  await syncNetworkProxy()
}

function syncNetworkProxySafely() {
  migrateThenSyncNetworkProxy().catch((error) => {
    console.warn('[DevGo] sync network proxy failed:', error)
  })
}

async function downloadNetworkRuleList(url: string): Promise<NetworkRuleListDownloadStatus> {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(url.trim())
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('规则列表 URL 仅支持 http/https')
    }
  } catch (error) {
    return {
      ok: false,
      url,
      error: error instanceof Error ? error.message : '请输入有效的规则列表 URL',
    }
  }

  try {
    const response = await fetch(parsedUrl.href, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`下载失败：HTTP ${response.status}`)
    }

    const text = decodeNetworkRuleListText(await response.text())
    const parsed = parseNetworkRuleList(text)
    if (parsed.proxyRules.length === 0 && parsed.directRules.length === 0) {
      throw new Error('未解析到有效的 AutoProxy 规则')
    }

    const lastUpdate = new Date().toISOString()
    await networkRuleList.setValue({
      enabled: true,
      format: 'AutoProxy',
      url: parsedUrl.href,
      text,
      lastUpdate,
      proxyRuleCount: parsed.proxyRules.length,
      directRuleCount: parsed.directRules.length,
    })

    return {
      ok: true,
      url: parsedUrl.href,
      lastUpdate,
      proxyRuleCount: parsed.proxyRules.length,
      directRuleCount: parsed.directRules.length,
    }
  } catch (error) {
    return {
      ok: false,
      url: parsedUrl.href,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function proxyCorsRequest(request: CorsProxyRequest): Promise<CorsProxyResponse> {
  if (!(await enableCorsBypass.getValue())) {
    return {
      url: request.url,
      status: 0,
      statusText: '',
      headers: [],
      body: '',
      redirected: false,
      error: 'CORS proxy is disabled',
    }
  }

  try {
    const method = request.method.toUpperCase()
    let requestBody: ArrayBuffer | undefined
    if (method !== 'GET' && method !== 'HEAD' && request.body) {
      requestBody = base64ToArrayBuffer(request.body)
    }

    const response = await fetch(request.url, {
      method,
      headers: request.headers,
      body: requestBody,
      credentials: request.credentials ?? 'include',
      redirect: request.redirect === 'manual' ? 'manual' : 'follow',
    })

    return {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
      body: arrayBufferToBase64(await response.arrayBuffer()),
      redirected: response.redirected,
    }
  } catch (error) {
    return {
      url: request.url,
      status: 0,
      statusText: '',
      headers: [],
      body: '',
      redirected: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const translationCache = new Map<string, string>()

function htmlToPlainText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|td|th)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim()
}

function getTranslationTarget(provider: TranslateProvider, text: string): string {
  return provider === 'google'
    ? pickTarget(text, { zh: 'zh-CN', en: 'en' })
    : pickTarget(text, { zh: 'zh-Hans', en: 'en' })
}

function getTranslationCacheKey(
  provider: TranslateProvider,
  html: boolean,
  target: string,
  text: string,
): string {
  return [provider, html ? 'html' : 'text', target, text].join('\u0000')
}

function getCachedTranslation(key: string): string | null {
  const cached = translationCache.get(key)
  if (cached == null) return null

  translationCache.delete(key)
  translationCache.set(key, cached)
  return cached
}

function setCachedTranslation(key: string, text: string) {
  if (!text) return

  translationCache.set(key, text)
  if (translationCache.size <= TRANSLATION_CACHE_LIMIT) return

  const oldestKey = translationCache.keys().next().value
  if (oldestKey) translationCache.delete(oldestKey)
}

/** 按当前所选引擎批量翻译；微软支持 HTML 模式，Google 免费路径统一降级为纯文本。 */
async function translateBatch(texts: string[], html = false): Promise<string[]> {
  const provider = await translateProvider.getValue()
  const results = Array(texts.length).fill('')
  const groups = new Map<
    string,
    {
      cacheKeys: string[]
      html: boolean
      indices: number[]
      target: string
      texts: string[]
    }
  >()

  texts.forEach((sourceText, index) => {
    const plainText = html ? htmlToPlainText(sourceText) : sourceText.trim()
    if (!plainText) return

    const target = getTranslationTarget(provider, plainText)
    const requestHtml = provider === 'microsoft' && html
    const requestText = requestHtml ? sourceText : plainText
    const cacheKey = getTranslationCacheKey(provider, requestHtml, target, requestText)
    const cached = getCachedTranslation(cacheKey)
    if (cached != null) {
      results[index] = cached
      return
    }

    const groupKey = `${target}\u0000${requestHtml ? 'html' : 'text'}`
    const group = groups.get(groupKey) ?? {
      cacheKeys: [],
      html: requestHtml,
      indices: [],
      target,
      texts: [],
    }

    group.indices.push(index)
    group.texts.push(requestText)
    group.cacheKeys.push(cacheKey)
    groups.set(groupKey, group)
  })

  await Promise.all(
    [...groups.values()].map(async (group) => {
      const translated =
        provider === 'google'
          ? await googleTransList(group.texts, group.target)
          : await microsoftTransList(group.texts, group.html, group.target)

      group.indices.forEach((sourceIndex, resultIndex) => {
        const text = translated[resultIndex] ?? ''
        results[sourceIndex] = text
        setCachedTranslation(group.cacheKeys[resultIndex], text)
      })
    }),
  )

  return results
}

/** 按当前所选引擎翻译文本；html=true 时尽量保留内联标签（仅微软支持） */
async function translateText(text: string, html = false): Promise<string> {
  const [result] = await translateBatch([text], html)
  return result ?? ''
}

/** 按当前所选引擎查词典 */
async function lookupWord(word: string): Promise<DictResult | null> {
  const provider = await translateProvider.getValue()
  return provider === 'google' ? googleLookup(word) : microsoftLookup(word)
}

/** 按当前所选引擎测试连通性 */
async function testProvider(): Promise<boolean> {
  const provider = await translateProvider.getValue()
  return provider === 'google' ? testGoogleTrans() : testMicrosoftTrans()
}

export default defineBackground(() => {
  restoreDevBackupIfNeeded().catch((error) => {
    console.warn('[DevGo] failed to import devgo-backup.json:', error)
  })

  // 监听来自内容脚本 / Popup 的请求消息
  browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (message?.type === 'test') {
      // 测试当前引擎连通性
      testProvider().then(sendResponse)
      return true // 保持消息通道打开以等待异步响应
    }

    if (message?.type === 'translate') {
      // 通过当前所选引擎翻译文本
      translateText(message.text, message.html).then((text) => sendResponse({ text }))
      return true
    }

    if (message?.type === 'translate-batch') {
      // 整页翻译批处理：后台统一做缓存、分组和限流
      translateBatch(message.texts, message.html).then((texts) => sendResponse({ texts }))
      return true
    }

    if (message?.type === 'lookup') {
      // 通过当前所选引擎查词典
      lookupWord(message.word).then(sendResponse)
      return true
    }

    if (message?.type === 'sync-cors-bypass') {
      // 同步 CORS 动态规则，返回实际是否已启用
      syncCorsBypassRules().then(sendResponse)
      return true
    }

    if (message?.type === 'cors-proxy-fetch') {
      proxyCorsRequest(message.request).then(sendResponse)
      return true
    }

    if (message?.type === 'apply-network-mode') {
      applyNetworkMode(message.mode).then(sendResponse)
      return true
    }

    if (message?.type === 'sync-network-proxy') {
      syncNetworkProxy().then(sendResponse)
      return true
    }

    if (message?.type === 'get-network-status') {
      getNetworkStatus().then(sendResponse)
      return true
    }

    if (message?.type === 'download-network-rule-list') {
      downloadNetworkRuleList(message.url).then(sendResponse)
      return true
    }

    if (message?.type === 'get-media-resources') {
      getMediaResources(message.tabId, message.includeDom).then(sendResponse)
      return true
    }

    if (message?.type === 'clear-media-resources') {
      clearMediaResources(message.tabId).then(sendResponse)
      return true
    }

    if (message?.type === 'download-media-resource') {
      downloadMediaResource(message.url, message.fileName, message.saveAs).then(sendResponse)
      return true
    }

    return false
  })

  chrome.webRequest?.onBeforeRequest.addListener(rememberMediaFromRequest, {
    urls: ['<all_urls>'],
    types: MEDIA_WEB_REQUEST_TYPES,
  })

  chrome.webRequest?.onResponseStarted.addListener(
    rememberMediaFromResponse,
    { urls: ['<all_urls>'], types: MEDIA_WEB_REQUEST_TYPES },
    ['responseHeaders'],
  )

  chrome.webRequest?.onCompleted.addListener(
    (details) => {
      if (details.tabId >= 0) {
        pendingMediaRequests.delete(getMediaRequestKey(details.tabId, details.requestId))
      }
    },
    { urls: ['<all_urls>'], types: MEDIA_WEB_REQUEST_TYPES },
  )

  chrome.webRequest?.onErrorOccurred.addListener(
    (details) => {
      if (details.tabId >= 0) {
        pendingMediaRequests.delete(getMediaRequestKey(details.tabId, details.requestId))
      }
    },
    { urls: ['<all_urls>'], types: MEDIA_WEB_REQUEST_TYPES },
  )

  // 右键菜单点击 -> 通知当前页面进行整页对比翻译
  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'inline-translate') {
      sendTabMessage({ type: 'translate-page' })
    }
  })

  // 快捷键命令
  browser.commands.onCommand.addListener((command) => {
    if (command === 'inline-translate') {
      sendTabMessage({ type: 'translate-page' })
      return
    }

    // open-todo / open-network / open-tools：打开 popup 并定位到对应 Tab。
    // 先写一次性信号，再主动弹出 popup。
    const COMMAND_TO_TAB: Record<string, string> = {
      'open-todo': 'todo',
      'open-network': 'network',
      'open-tools': 'tools',
    }
    const tab = COMMAND_TO_TAB[command]
    if (tab) {
      popupInitialTab.setValue(tab).then(() => {
        browser.action.openPopup?.().catch((error) => {
          console.warn('[DevGo] openPopup failed:', error)
        })
      })
    }
  })

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.url) {
      clearTabMediaResources(tabId)
    }
  })

  browser.tabs.onRemoved.addListener((tabId) => {
    clearTabMediaResources(tabId)
  })

  // 安装 / 更新时初始化（右键菜单需在此创建，避免 SW 重启时重复创建报错）
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'inline-translate',
      title: '对比翻译',
      contexts: ['page', 'selection'],
    })

    syncCorsBypassRulesSafely()
    syncMicrosoftRequestRulesSafely()
  })

  browser.runtime.onStartup.addListener(() => {
    syncCorsBypassRulesSafely()
    syncMicrosoftRequestRulesSafely()
    syncNetworkProxySafely()
  })

  enableCorsBypass.watch(syncCorsBypassRulesSafely)
  networkMode.watch(syncNetworkProxySafely)
  networkProxyProfile.watch(syncNetworkProxySafely)
  networkProxyBypassList.watch(syncNetworkProxySafely)
  networkRuleList.watch(syncNetworkProxySafely)

  // 工具栏图标随网络模式变色（SW 每次启动都重设，避免动态图标丢失）
  updateNetworkActionIconSafely()
  networkMode.watch(updateNetworkActionIconSafely)
  networkProxyManaged.watch(updateNetworkActionIconSafely)

  chrome.proxy?.onProxyError?.addListener((details) => {
    console.warn('[DevGo] proxy error:', details)
  })
})
