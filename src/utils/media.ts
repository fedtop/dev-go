import type {
  MediaResource,
  MediaResourceCandidate,
  MediaResourceKind,
  MediaResourceSource,
} from '@/utils/messaging'

const IMAGE_EXTENSIONS = new Set([
  'apng',
  'avif',
  'bmp',
  'gif',
  'ico',
  'jfif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
])

const VIDEO_EXTENSIONS = new Set([
  '3gp',
  'avi',
  'dash',
  'flv',
  'm3u8',
  'm4s',
  'm4v',
  'mkv',
  'mov',
  'mp4',
  'mpd',
  'mpeg',
  'mpg',
  'ogv',
  'ts',
  'webm',
  'wmv',
])

const VIDEO_MIME_VALUES = new Set([
  'application/dash+xml',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'application/mpegurl',
  'application/mp4',
  'application/octet-stream',
  'audio/mpegurl',
  'audio/x-mpegurl',
])

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'video/mp2t': 'ts',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/dash+xml': 'mpd',
  'application/vnd.apple.mpegurl': 'm3u8',
  'application/x-mpegurl': 'm3u8',
  'application/mpegurl': 'm3u8',
}

export function normalizeMime(value?: string): string {
  return value?.split(';')[0]?.trim().toLowerCase() || ''
}

export function getUrlExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const file = pathname.split('/').pop() || ''
    const match = /\.([a-z0-9]+)$/i.exec(file)
    return match?.[1]?.toLowerCase() || ''
  } catch {
    const match = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)
    return match?.[1]?.toLowerCase() || ''
  }
}

export function normalizeMediaUrl(value: string, baseUrl?: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('data:')) return null

  try {
    const url = new URL(trimmed, baseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

export function isDownloadableMediaUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function inferMediaKind(input: {
  url: string
  mime?: string
  resourceType?: string
}): MediaResourceKind | null {
  const mime = normalizeMime(input.mime)
  const extension = getUrlExtension(input.url)
  const resourceType = input.resourceType?.toLowerCase()

  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/') || VIDEO_MIME_VALUES.has(mime)) {
    if (mime === 'application/octet-stream' && !VIDEO_EXTENSIONS.has(extension)) return null
    return 'video'
  }

  if (resourceType === 'image') return 'image'
  if (resourceType === 'media') return 'video'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'

  return null
}

export function inferExtension(url: string, mime?: string): string {
  const extension = getUrlExtension(url)
  if (extension) return extension

  const normalizedMime = normalizeMime(mime)
  return MIME_EXTENSION_MAP[normalizedMime] || ''
}

export function sanitizeFileName(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || 'media'
}

export function buildMediaFileName(
  url: string,
  kind: MediaResourceKind,
  mime?: string,
  fallbackName?: string,
): string {
  const extension = inferExtension(url, mime)
  const fallback = kind === 'image' ? 'image' : 'video'
  let name = fallbackName || fallback

  try {
    const pathnameName = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
    if (pathnameName) name = pathnameName
  } catch {
    // 保留 fallback
  }

  const sanitized = sanitizeFileName(name)
  if (!extension || sanitized.toLowerCase().endsWith(`.${extension}`)) return sanitized
  return `${sanitized}.${extension}`
}

export function getMediaResourceId(kind: MediaResourceKind, url: string): string {
  return `${kind}:${url}`
}

export function getTwitterMediaKey(url: string): string | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    if (!hostname.endsWith('twimg.com')) return null

    const pathname = parsed.pathname
    const typedMatch =
      /\/(ext_tw_video_thumb|ext_tw_video|amplify_video_thumb|amplify_video)\/([^/]+)/.exec(
        pathname,
      )
    if (typedMatch) {
      return `${typedMatch[1].replace('_thumb', '')}:${typedMatch[2]}`
    }

    const tweetVideoMatch = /\/(tweet_video_thumb|tweet_video)\/([^/?#.]+)/.exec(pathname)
    if (tweetVideoMatch) {
      return `tweet_video:${tweetVideoMatch[2].replace(/\.[a-z0-9]+$/i, '')}`
    }

    return null
  } catch {
    return null
  }
}

export function mergeMediaSource(
  current: MediaResourceSource,
  next: MediaResourceCandidate['source'],
): MediaResourceSource {
  if (current === next || current === 'network+dom') return current
  return 'network+dom'
}

export function buildMediaResource(
  tabId: number,
  candidate: MediaResourceCandidate,
  now = Date.now(),
): MediaResource {
  const extension = candidate.extension || inferExtension(candidate.url, candidate.mime)

  return {
    id: getMediaResourceId(candidate.kind, candidate.url),
    tabId,
    url: candidate.url,
    kind: candidate.kind,
    source: candidate.source,
    pageUrl: candidate.pageUrl,
    mime: normalizeMime(candidate.mime) || undefined,
    extension: extension || undefined,
    fileName: buildMediaFileName(candidate.url, candidate.kind, candidate.mime, candidate.fileName),
    thumbnailUrl: candidate.thumbnailUrl,
    size: candidate.size,
    width: candidate.width,
    height: candidate.height,
    firstSeen: candidate.firstSeen || now,
    lastSeen: candidate.lastSeen || now,
  }
}
