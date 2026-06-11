const EXPLICIT_SCHEME_RE = /^[a-z][a-z\d+.-]*:/i
const INTERNAL_PROTOCOLS = new Set(['about:', 'chrome:', 'edge:'])
const FAVICON_PROTOCOLS = new Set(['http:', 'https:'])

function getProtocol(url: string): string | null {
  try {
    return new URL(url).protocol
  } catch {
    return null
  }
}

export function normalizeNavUrl(url: string): string {
  const value = url.trim()
  if (!value) return ''
  return EXPLICIT_SCHEME_RE.test(value) ? value : `https://${value}`
}

export function isBrowserInternalUrl(url: string): boolean {
  const protocol = getProtocol(url)
  return protocol != null && INTERNAL_PROTOCOLS.has(protocol)
}

export function isFaviconSupportedUrl(url: string): boolean {
  const protocol = getProtocol(url)
  return protocol != null && FAVICON_PROTOCOLS.has(protocol)
}

export function openBrowserInternalUrl(url: string): boolean {
  if (!isBrowserInternalUrl(url)) return false

  browser.tabs.create({ url }).catch((error) => {
    console.warn('[DevGo] open internal page failed:', error)
  })
  return true
}
