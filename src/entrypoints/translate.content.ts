import { setNotranslateNode } from '@/utils/no-translate'
import {
  sendRuntimeMessage,
  type MediaResourceCandidate,
  type MediaResourceKind,
  type TabMessage,
} from '@/utils/messaging'
import { inferMediaKind, normalizeMediaUrl, normalizeMime } from '@/utils/media'

// DevGo 专属标记：避免与网站自带 class 冲突
const TRANS_NODE_CLASS = 'devgo-translation'
const TRANSLATED_CLASS = 'devgo-translated'
const TRANSLATING_CLASS = 'devgo-translating'
const TRANS_ATTR = 'data-devgo-translation'
const ORIGINAL_ATTR = 'data-devgo-translated'
const STYLE_ID = 'devgo-translation-style'

const BATCH_SIZE = 12
const FLUSH_DELAY = 80
const SCAN_DELAY = 300
const MIN_TEXT_LENGTH = 2
const MAX_TEXT_LENGTH = 1800
const MAX_DOM_MEDIA_RESOURCES = 500
const MAX_BACKGROUND_SCAN_ELEMENTS = 1500

const CANDIDATE_SELECTOR = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'blockquote',
  'figcaption',
  'dt',
  'dd',
  'summary',
  'caption',
  'td',
  'th',
  'article div',
  'main div',
  '[role="main"] div',
  '[role="article"] div',
  '.markdown-body div',
  '[class*="content"] div',
  '[class*="article"] div',
].join(',')

const STRUCTURAL_CHILD_SELECTOR = [
  'article',
  'section',
  'main',
  'div',
  'p',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'blockquote',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
].join(',')

const SKIP_SELECTOR = [
  `.${TRANS_NODE_CLASS}`,
  '.notranslate',
  '[translate="no"]',
  '[aria-hidden="true"]',
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'math',
  'pre',
  'code',
  'kbd',
  'samp',
  'textarea',
  'input',
  'select',
  'option',
  'button',
  'menu',
  'nav',
  'form',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="button"]',
  '[role="navigation"]',
].join(',')

const ROOT_SELECTOR = [
  'article',
  'main',
  '[role="main"]',
  '.markdown-body',
  '.post-content',
  '.entry-content',
  '.article-content',
  '.content',
].join(',')

const ALLOWED_TRANSLATION_TAGS = new Set([
  'a',
  'b',
  'br',
  'code',
  'em',
  'i',
  'kbd',
  'mark',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
])
const ALLOWED_COMMON_ATTRS = new Set(['dir', 'lang', 'title'])

let translationSession = 0
let translationActive = false
let mutationObserver: MutationObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let scanTimer: number | null = null
let flushTimer: number | null = null
let processingQueue = false
let trackedNodes = new WeakSet<HTMLElement>()
const queuedNodes = new Set<HTMLElement>()

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    injectTranslationStyle()

    // 监听来自 Background / Popup 的指令
    browser.runtime.onMessage.addListener((message: TabMessage) => {
      if (message?.type === 'collect-media-resources') {
        return Promise.resolve(collectPageMediaResources())
      }

      switch (message?.type) {
        case 'translate-page':
          // 已翻译或正在翻译则再次点击移除，恢复原样（toggle）
          if (removeTranslations()) break
          startPageTranslation().catch((error) => {
            console.warn('[DevGo] start page translation failed:', error)
          })
          break
        case 'tip':
          // eslint-disable-next-line no-alert
          alert(message.msg)
          break
        default:
          break
      }

      return undefined
    })

    // DOM 就绪后，标记浏览器自带翻译需要忽略的元素
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', setNotranslateNode)
    } else {
      setNotranslateNode()
    }
  },
})

function injectTranslationStyle() {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
@keyframes devgo-translation-loading {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}

.${TRANSLATING_CLASS}::after {
  content: "";
  display: block;
  width: min(22rem, 72%);
  max-width: 100%;
  height: 0.72em;
  margin: 0.38em 0 0.18em;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(37, 99, 235, 0.12) 0%,
    rgba(37, 99, 235, 0.32) 42%,
    rgba(37, 99, 235, 0.12) 84%
  );
  background-size: 220% 100%;
  animation: devgo-translation-loading 1.05s ease-in-out infinite;
  pointer-events: none;
}

.${TRANS_NODE_CLASS} {
  opacity: 0.88;
}
`
  ;(document.head || document.documentElement).appendChild(style)
}

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

function collectPageMediaResources(): MediaResourceCandidate[] {
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

async function waitForBody(): Promise<void> {
  if (document.body) return
  await new Promise<void>((resolve) => {
    window.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
  })
}

async function startPageTranslation() {
  await waitForBody()

  resetTranslationRuntime()
  translationActive = true
  const session = translationSession

  const ok = await testConnection()
  if (!ok || session !== translationSession || !translationActive) {
    if (session === translationSession) resetTranslationRuntime()
    return
  }

  const root = pickTranslationRoot()

  setupIntersectionObserver(session)
  scanAndTrack(root, session)
  setupMutationObserver(root, session)
}

function resetTranslationRuntime() {
  translationSession += 1
  translationActive = false
  mutationObserver?.disconnect()
  intersectionObserver?.disconnect()
  mutationObserver = null
  intersectionObserver = null
  trackedNodes = new WeakSet<HTMLElement>()
  queuedNodes.clear()
  processingQueue = false

  if (scanTimer) window.clearTimeout(scanTimer)
  if (flushTimer) window.clearTimeout(flushTimer)
  scanTimer = null
  flushTimer = null
}

// 测试连通性
async function testConnection(): Promise<boolean> {
  const ok = await sendRuntimeMessage({ type: 'test' })
  if (!ok) {
    // eslint-disable-next-line no-alert
    alert('翻译服务不稳定！请检查网络，或在弹窗里切换翻译引擎。')
  }
  return ok
}

// 移除页面上所有 DevGo 译文，恢复原样；有移除或正在翻译则返回 true
function removeTranslations(): boolean {
  const transNodes = document.querySelectorAll(`.${TRANS_NODE_CLASS},[${TRANS_ATTR}="true"]`)
  const hadTranslations = transNodes.length > 0 || translationActive
  if (!hadTranslations) return false

  resetTranslationRuntime()
  transNodes.forEach((node) => node.remove())
  document
    .querySelectorAll(`.${TRANSLATED_CLASS},.${TRANSLATING_CLASS},[${ORIGINAL_ATTR}="true"]`)
    .forEach((el) => {
      el.classList.remove(TRANSLATED_CLASS, TRANSLATING_CLASS)
      el.removeAttribute(ORIGINAL_ATTR)
    })

  return true
}

function pickTranslationRoot(): HTMLElement {
  const body = document.body
  let best: HTMLElement = body
  let bestLength = 0

  document.querySelectorAll<HTMLElement>(ROOT_SELECTOR).forEach((node) => {
    if (node.closest(SKIP_SELECTOR) || !isVisible(node)) return
    const textLength = getElementText(node).length
    if (textLength > bestLength && textLength >= 200) {
      best = node
      bestLength = textLength
    }
  })

  return best
}

function setupIntersectionObserver(session: number) {
  if (!('IntersectionObserver' in window)) {
    intersectionObserver = null
    return
  }

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      if (session !== translationSession || !translationActive) return

      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const node = entry.target
        if (!(node instanceof HTMLElement)) return

        intersectionObserver?.unobserve(node)
        enqueueNode(node, session)
      })
    },
    {
      rootMargin: '900px 0px 1400px 0px',
      threshold: 0,
    },
  )
}

function setupMutationObserver(root: HTMLElement, session: number) {
  mutationObserver = new MutationObserver((mutations) => {
    if (session !== translationSession || !translationActive) return

    const hasRelevantChange = mutations.some((mutation) =>
      [...mutation.addedNodes].some(
        (node) =>
          node instanceof HTMLElement &&
          !node.classList.contains(TRANS_NODE_CLASS) &&
          node.getAttribute(TRANS_ATTR) !== 'true',
      ),
    )

    if (hasRelevantChange) scheduleScan(root, session)
  })

  mutationObserver.observe(root, { childList: true, subtree: true })
}

function scheduleScan(root: HTMLElement, session: number) {
  if (scanTimer) window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    scanTimer = null
    scanAndTrack(root, session)
  }, SCAN_DELAY)
}

function scanAndTrack(root: HTMLElement, session: number) {
  if (session !== translationSession || !translationActive || !root.isConnected) return

  if (root.matches(CANDIDATE_SELECTOR)) {
    trackCandidate(root, session)
  }
  root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR).forEach((node) => {
    trackCandidate(node, session)
  })
}

function trackCandidate(node: HTMLElement, session: number) {
  if (trackedNodes.has(node) || !isCandidateElement(node)) return

  trackedNodes.add(node)
  if (intersectionObserver) {
    intersectionObserver.observe(node)
    return
  }

  enqueueNode(node, session)
}

function enqueueNode(node: HTMLElement, session: number) {
  if (session !== translationSession || !translationActive || !isCandidateElement(node)) return

  queuedNodes.add(node)
  scheduleFlush(session)
}

function scheduleFlush(session: number) {
  if (flushTimer || processingQueue) return

  flushTimer = window.setTimeout(() => {
    flushTimer = null
    flushQueue(session).catch((error) => {
      console.warn('[DevGo] flush translation queue failed:', error)
    })
  }, FLUSH_DELAY)
}

async function flushQueue(session: number) {
  if (processingQueue || session !== translationSession || !translationActive) return

  const nodes: HTMLElement[] = []
  while (queuedNodes.size > 0 && nodes.length < BATCH_SIZE) {
    const next = queuedNodes.values().next()
    if (next.done) break

    const node = next.value
    queuedNodes.delete(node)
    if (isCandidateElement(node)) nodes.push(node)
  }

  if (nodes.length === 0) {
    if (queuedNodes.size > 0) scheduleFlush(session)
    return
  }

  processingQueue = true
  nodes.forEach((node) => node.classList.add(TRANSLATING_CLASS))

  try {
    const { uniqueTexts, textIndexes } = buildBatchPayload(nodes)
    const response = await sendRuntimeMessage({
      type: 'translate-batch',
      texts: uniqueTexts,
      html: true,
    })

    if (session !== translationSession || !translationActive) return

    nodes.forEach((node, index) => {
      const translated = response.texts[textIndexes[index]] ?? ''
      node.classList.remove(TRANSLATING_CLASS)
      node.classList.add(TRANSLATED_CLASS)
      node.setAttribute(ORIGINAL_ATTR, 'true')
      insertTransResult(node, translated)
    })
  } catch (error) {
    console.warn('[DevGo] translate page batch failed:', error)
    nodes.forEach((node) => node.classList.remove(TRANSLATING_CLASS))
  } finally {
    processingQueue = false
    if (session === translationSession && translationActive && queuedNodes.size > 0) {
      scheduleFlush(session)
    }
  }
}

function buildBatchPayload(nodes: HTMLElement[]): {
  textIndexes: number[]
  uniqueTexts: string[]
} {
  const uniqueTexts: string[] = []
  const uniqueIndex = new Map<string, number>()
  const textIndexes = nodes.map((node) => {
    const source = buildSourceHtml(node)
    const cachedIndex = uniqueIndex.get(source)
    if (cachedIndex != null) return cachedIndex

    const nextIndex = uniqueTexts.length
    uniqueTexts.push(source)
    uniqueIndex.set(source, nextIndex)
    return nextIndex
  })

  return { textIndexes, uniqueTexts }
}

function buildSourceHtml(node: HTMLElement): string {
  const html = node.innerHTML.trim()
  return html || getElementText(node)
}

function isCandidateElement(node: HTMLElement): boolean {
  if (!node.isConnected) return false
  if (node.classList.contains(TRANS_NODE_CLASS)) return false
  if (node.classList.contains(TRANSLATED_CLASS) || node.classList.contains(TRANSLATING_CLASS)) {
    return false
  }
  if (node.getAttribute(ORIGINAL_ATTR) === 'true' || node.getAttribute(TRANS_ATTR) === 'true') {
    return false
  }
  if (node.closest(SKIP_SELECTOR)) return false
  if (!isVisible(node)) return false
  if (hasStructuralChild(node)) return false

  return isTranslatableText(getElementText(node))
}

function hasStructuralChild(node: HTMLElement): boolean {
  return [...node.children].some((child) => {
    if (!(child instanceof HTMLElement)) return false
    if (child.closest(SKIP_SELECTOR)) return false
    return child.matches(STRUCTURAL_CHILD_SELECTOR) && isTranslatableText(getElementText(child))
  })
}

function getElementText(node: HTMLElement): string {
  return (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim()
}

function isVisible(node: HTMLElement): boolean {
  const style = window.getComputedStyle(node)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false
  }
  return node.getClientRects().length > 0
}

function isTranslatableText(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length < MIN_TEXT_LENGTH || normalized.length > MAX_TEXT_LENGTH) return false
  if (/^https?:\/\//i.test(normalized)) return false
  if (/^[\d\s.,:%/()+\-–—]+$/.test(normalized)) return false

  const meaningfulChars = normalized.match(/[\p{L}\p{N}\u4e00-\u9fff]/gu)?.length ?? 0
  return meaningfulChars >= MIN_TEXT_LENGTH
}

function stripHtml(text: string): string {
  if (!looksLikeHtml(text)) return text

  const doc = new DOMParser().parseFromString(text, 'text/html')
  return doc.body.textContent ?? text
}

function normalizeComparableText(text: string): string {
  return stripHtml(text)
    .replace(/\s+/g, '')
    .replace(/[，。？！：；、,.!?;:]/g, '')
    .toLowerCase()
}

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text)
}

function cleanTranslatedText(text: string): string {
  return text.trim().replace(/^[\s，。？！：；、,.!?;:]+/, '')
}

function isSafeHref(value: string): boolean {
  if (value.startsWith('#') || value.startsWith('/')) return true

  try {
    const url = new URL(value, window.location.href)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}

function sanitizeTranslationHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.body.firstElementChild
  if (!container) return ''

  const sanitizeNode = (node: Element) => {
    ;[...node.children].forEach((child) => {
      const tag = child.tagName.toLowerCase()
      if (!ALLOWED_TRANSLATION_TAGS.has(tag)) {
        child.replaceWith(doc.createTextNode(child.textContent ?? ''))
        return
      }

      ;[...child.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase()
        const value = attr.value
        const keepCommon = ALLOWED_COMMON_ATTRS.has(name)
        const keepHref = tag === 'a' && name === 'href' && isSafeHref(value)

        if (!keepCommon && !keepHref) {
          child.removeAttribute(attr.name)
        }
      })

      sanitizeNode(child)
    })
  }

  sanitizeNode(container)
  return container.innerHTML
}

// 插入译文：克隆原元素，保留其标签 / class / 颜色 / 字号等样式，仅替换文字，
// 使译文与原文外观一致（参考沉浸式翻译的对照阅读体验）
export function insertTransResult(node: HTMLElement, transResult: string): boolean {
  const text = cleanTranslatedText(transResult)
  if (!text) return false

  const sourceText = getElementText(node)
  if (normalizeComparableText(sourceText) === normalizeComparableText(text)) return false

  // 克隆原节点（不含子节点）-> 继承同标签、同 class、同颜色、同字号
  const clone = node.cloneNode(false) as HTMLElement
  clone.removeAttribute('id')
  clone.removeAttribute(ORIGINAL_ATTR)
  clone.classList.remove(TRANSLATED_CLASS, TRANSLATING_CLASS)
  clone.classList.add(TRANS_NODE_CLASS, 'notranslate')
  clone.setAttribute(TRANS_ATTR, 'true')
  clone.style.marginTop = '2px'

  if (looksLikeHtml(text)) {
    clone.innerHTML = sanitizeTranslationHtml(text)
  } else {
    clone.textContent = text
  }

  node.insertAdjacentElement('afterend', clone)
  return true
}
