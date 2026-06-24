import { type ReactNode, useEffect, useMemo, useState } from 'react'

import {
  getDirectMediaDownloadBlockReason,
  getMediaDeliveryType,
  getUrlExtension,
  isDirectDownloadableMediaUrl,
  normalizeMime,
  type MediaDeliveryType,
} from '@/utils/media'
import { sendRuntimeMessage, type MediaResource, type MediaResourceKind } from '@/utils/messaging'
import Button from '@/ui/Button'

type ResourceFilter = 'all' | MediaResourceKind

const FILTERS: Array<{ value: ResourceFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
]

const KIND_LABELS: Record<MediaResourceKind, string> = {
  image: '图片',
  video: '视频',
}

const SOURCE_LABELS: Record<MediaResource['source'], string> = {
  network: '请求',
  dom: '页面',
  'network+dom': '请求+页面',
}
const DELIVERY_LABELS: Partial<Record<MediaDeliveryType, string>> = {
  'stream-manifest': '流清单',
  'stream-segment': '流分片',
  'twitter-audio-track': 'X 音频轨',
  'twitter-video-track': 'X 视频轨',
}
const VIDEO_PREVIEW_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v'])

function formatBytes(value?: number): string {
  if (!value) return ''

  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function getPageLabel(tab: chrome.tabs.Tab | null): string {
  if (!tab?.url) return '当前标签页'

  try {
    return new URL(tab.url).hostname
  } catch {
    return tab.title || '当前标签页'
  }
}

function getResourceMeta(resource: MediaResource): string[] {
  const deliveryLabel = DELIVERY_LABELS[getMediaDeliveryType(resource.url, resource.mime)]

  return [
    deliveryLabel,
    resource.extension?.toUpperCase(),
    resource.mime,
    resource.width && resource.height ? `${resource.width}x${resource.height}` : '',
    formatBytes(resource.size),
    SOURCE_LABELS[resource.source],
  ].filter(Boolean) as string[]
}

function DownloadIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-none stroke-current'>
      <path d='M12 3v11' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      <path d='m7 10 5 5 5-5' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M5 20h14' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-none stroke-current'>
      <path
        d='M8 8h10v10H8zM6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-none stroke-current'>
      <path d='M14 4h6v6' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      <path d='m10 14 10-10' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      <path
        d='M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-current'>
      <path d='M8 5.5v13l11-6.5z' />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-current'>
      <path d='M7 7h10v10H7z' />
    </svg>
  )
}

function canPreviewVideo(resource: MediaResource): boolean {
  if (resource.kind !== 'video') return false
  if (getMediaDeliveryType(resource.url, resource.mime) !== 'direct') return false

  const extension = (resource.extension || getUrlExtension(resource.url)).toLowerCase()
  const mime = normalizeMime(resource.mime)

  return VIDEO_PREVIEW_EXTENSIONS.has(extension) || ['video/mp4', 'video/webm'].includes(mime)
}

function ResourceFallbackIcon({ kind }: { kind: MediaResourceKind }) {
  return kind === 'video' ? (
    <PlayIcon />
  ) : (
    <span className='h-5 w-6 rounded border border-slate-300 bg-white shadow-inner' />
  )
}

interface IconButtonProps {
  title: string
  disabled?: boolean
  active?: boolean
  children: ReactNode
  onClick: () => void
}

function IconButton({
  title,
  disabled = false,
  active = false,
  children,
  onClick,
}: IconButtonProps) {
  return (
    <button
      type='button'
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600'
      }`}
    >
      {children}
    </button>
  )
}

function ResourceThumbnail({
  resource,
  previewing,
  onTogglePreview,
}: {
  resource: MediaResource
  previewing: boolean
  onTogglePreview: (resource: MediaResource) => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const imageUrl = resource.thumbnailUrl || (resource.kind === 'image' ? resource.url : '')
  const showImage = Boolean(imageUrl && !imageFailed)
  const showVideo = !showImage && !videoFailed && canPreviewVideo(resource)
  const showPlay = resource.kind === 'video' && (showImage || showVideo)
  const previewable = canPreviewVideo(resource)

  const content = (
    <>
      {showImage && (
        <img
          src={imageUrl}
          alt=''
          loading='lazy'
          className='h-full w-full object-cover'
          onError={() => setImageFailed(true)}
        />
      )}

      {showVideo && (
        <video
          src={resource.url}
          muted
          playsInline
          preload='metadata'
          className='h-full w-full object-cover'
          onError={() => setVideoFailed(true)}
        />
      )}

      {!showImage && !showVideo && <ResourceFallbackIcon kind={resource.kind} />}

      {showPlay && (
        <span className='absolute inset-0 flex items-center justify-center bg-black/10'>
          <span className='flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white'>
            {previewing ? <StopIcon /> : <PlayIcon />}
          </span>
        </span>
      )}
    </>
  )

  if (!previewable) {
    return (
      <div className='relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-500'>
        {content}
      </div>
    )
  }

  return (
    <button
      type='button'
      title={previewing ? '收起预览' : '预览视频'}
      aria-label={previewing ? '收起预览' : '预览视频'}
      onClick={() => onTogglePreview(resource)}
      className='relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-500 outline-none transition-shadow hover:ring-2 hover:ring-blue-200'
    >
      {content}
    </button>
  )
}

interface ResourceItemProps {
  resource: MediaResource
  downloading: boolean
  previewing: boolean
  onCopy: (resource: MediaResource) => void
  onDownload: (resource: MediaResource) => void
  onOpen: (resource: MediaResource) => void
  onTogglePreview: (resource: MediaResource) => void
}

function ResourceItem({
  resource,
  downloading,
  previewing,
  onCopy,
  onDownload,
  onOpen,
  onTogglePreview,
}: ResourceItemProps) {
  const meta = getResourceMeta(resource)
  const previewable = canPreviewVideo(resource)
  const downloadBlockReason = getDirectMediaDownloadBlockReason(resource.url, resource.mime)
  let previewTitle = '当前格式不能在 popup 预览'

  if (previewing) {
    previewTitle = '收起预览'
  } else if (previewable) {
    previewTitle = '预览视频'
  }

  return (
    <div className='rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'>
      <div className='flex gap-2'>
        <ResourceThumbnail
          resource={resource}
          previewing={previewing}
          onTogglePreview={onTogglePreview}
        />

        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-1.5'>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                resource.kind === 'image'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              {KIND_LABELS[resource.kind]}
            </span>
            <span className='truncate text-xs font-medium text-slate-800' title={resource.fileName}>
              {resource.fileName}
            </span>
          </div>

          <div className='mt-1 truncate text-[11px] text-slate-400' title={resource.url}>
            {getHostname(resource.url)}
          </div>

          {meta.length > 0 && (
            <div className='mt-1 flex flex-wrap gap-1'>
              {meta.map((item) => (
                <span
                  key={item}
                  className='max-w-[150px] truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500'
                  title={item}
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className='grid shrink-0 grid-cols-2 gap-1'>
          {resource.kind === 'video' ? (
            <IconButton
              title={previewTitle}
              active={previewing}
              disabled={!previewable}
              onClick={() => onTogglePreview(resource)}
            >
              {previewing ? <StopIcon /> : <PlayIcon />}
            </IconButton>
          ) : (
            <span className='h-7 w-7' aria-hidden='true' />
          )}
          <IconButton
            title={downloadBlockReason || '下载'}
            disabled={downloading || Boolean(downloadBlockReason)}
            onClick={() => onDownload(resource)}
          >
            <DownloadIcon />
          </IconButton>
          <IconButton title='复制链接' onClick={() => onCopy(resource)}>
            <CopyIcon />
          </IconButton>
          <IconButton title='打开链接' onClick={() => onOpen(resource)}>
            <ExternalLinkIcon />
          </IconButton>
        </div>
      </div>

      {previewing && previewable && (
        <div className='mt-2 overflow-hidden rounded-md bg-black'>
          <video
            src={resource.url}
            poster={resource.thumbnailUrl}
            controls
            playsInline
            preload='metadata'
            className='aspect-video max-h-56 w-full bg-black object-contain'
          />
        </div>
      )}
    </div>
  )
}

export default function ToolsPage() {
  const [resources, setResources] = useState<MediaResource[]>([])
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [filter, setFilter] = useState<ResourceFilter>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [statusError, setStatusError] = useState(false)
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({})
  const [previewingId, setPreviewingId] = useState('')

  const counts = useMemo(
    () => ({
      all: resources.length,
      image: resources.filter((resource) => resource.kind === 'image').length,
      video: resources.filter((resource) => resource.kind === 'video').length,
    }),
    [resources],
  )

  const filteredResources = useMemo(() => {
    const keyword = query.trim().toLowerCase()

    return resources.filter((resource) => {
      if (filter !== 'all' && resource.kind !== filter) return false
      if (!keyword) return true

      return [
        resource.fileName,
        resource.url,
        resource.mime,
        resource.extension,
        getHostname(resource.url),
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword))
    })
  }, [filter, query, resources])

  const loadResources = async (includeDom = true) => {
    if (loading) return
    setLoading(true)
    setStatus('')
    setStatusError(false)

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      setCurrentTab(tab || null)

      if (tab?.id == null) {
        setStatusError(true)
        setStatus('无法读取当前标签页')
        setResources([])
        return
      }

      const result = await sendRuntimeMessage({
        type: 'get-media-resources',
        tabId: tab.id,
        includeDom,
      })

      setResources(result.resources)
      setPreviewingId((current) =>
        result.resources.some((resource) => resource.id === current) ? current : '',
      )
      if (result.error) {
        setStatusError(true)
        setStatus(result.error)
      }
    } catch (error) {
      setStatusError(true)
      setStatus(error instanceof Error ? error.message : String(error))
      setResources([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadResources().catch((error) => {
      console.warn('[DevGo] load media resources failed:', error)
    })
  }, [])

  const clearResources = async () => {
    if (loading || currentTab?.id == null) return
    setLoading(true)
    setStatus('')
    setStatusError(false)

    try {
      const result = await sendRuntimeMessage({
        type: 'clear-media-resources',
        tabId: currentTab.id,
      })
      setResources([])
      setPreviewingId('')
      setStatus(`已清空 ${result.removed} 条资源`)
    } catch (error) {
      setStatusError(true)
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const copyResourceUrl = async (resource: MediaResource) => {
    try {
      await navigator.clipboard.writeText(resource.url)
      setStatus('链接已复制')
      setStatusError(false)
    } catch {
      setStatusError(true)
      setStatus('复制失败')
    }
  }

  const openResource = (resource: MediaResource) => {
    browser.tabs.create({ url: resource.url })
  }

  const togglePreview = (resource: MediaResource) => {
    if (!canPreviewVideo(resource)) return
    setPreviewingId((current) => (current === resource.id ? '' : resource.id))
  }

  const downloadResource = async (resource: MediaResource, saveAs = true): Promise<boolean> => {
    const blockReason = getDirectMediaDownloadBlockReason(resource.url, resource.mime)
    if (blockReason) {
      setStatusError(true)
      setStatus(blockReason)
      return false
    }

    setDownloadingIds((current) => ({ ...current, [resource.id]: true }))

    try {
      const result = await sendRuntimeMessage({
        type: 'download-media-resource',
        url: resource.url,
        fileName: resource.fileName,
        mime: resource.mime,
        saveAs,
      })

      if (!result.ok) {
        setStatusError(true)
        setStatus(result.error || '下载任务创建失败')
        return false
      }

      setStatusError(false)
      setStatus('下载任务已创建')
      return true
    } catch (error) {
      setStatusError(true)
      setStatus(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      setDownloadingIds((current) => ({ ...current, [resource.id]: false }))
    }
  }

  const downloadAll = async () => {
    if (bulkBusy) return

    const downloadables = filteredResources.filter((resource) =>
      isDirectDownloadableMediaUrl(resource.url, resource.mime),
    )
    const skippedCount = filteredResources.length - downloadables.length

    if (downloadables.length === 0) {
      setStatusError(true)
      setStatus(skippedCount > 0 ? '没有可直接下载成完整文件的资源' : '没有可下载资源')
      return
    }

    setBulkBusy(true)
    // 批量下载不弹出逐个保存窗口，避免大量系统对话框。
    const results = await Promise.all(
      downloadables.map((resource) => downloadResource(resource, false)),
    )
    const okCount = results.filter(Boolean).length

    setBulkBusy(false)
    setStatusError(okCount === 0)
    setStatus(
      skippedCount > 0
        ? `已创建 ${okCount}/${downloadables.length} 个下载任务，跳过 ${skippedCount} 个流媒体片段`
        : `已创建 ${okCount}/${downloadables.length} 个下载任务`,
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      <section className='rounded-lg border border-slate-200 bg-white p-3 shadow-sm'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='text-sm font-semibold text-slate-800'>资源嗅探</div>
            <div className='mt-0.5 truncate text-xs text-slate-400'>{getPageLabel(currentTab)}</div>
          </div>
          <div className='flex shrink-0 gap-1.5'>
            <Button
              onClick={() => loadResources()}
              loading={loading}
              className='!px-2 !py-1 text-xs'
            >
              刷新
            </Button>
            <Button
              onClick={clearResources}
              disabled={loading || resources.length === 0}
              className='!px-2 !py-1 text-xs'
            >
              清空
            </Button>
          </div>
        </div>

        <div className='mt-3 grid grid-cols-3 gap-2'>
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type='button'
              onClick={() => setFilter(item.value)}
              className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${
                filter === item.value
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className='block text-[10px]'>{item.label}</span>
              <span className='mt-0.5 block text-sm font-semibold'>{counts[item.value]}</span>
            </button>
          ))}
        </div>

        <div className='mt-3 flex gap-2'>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='搜索名称、域名或类型'
            className='min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:bg-white'
          />
          <Button
            onClick={downloadAll}
            loading={bulkBusy}
            disabled={filteredResources.length === 0}
            className='!px-2.5 !py-1.5 text-xs'
          >
            下载全部
          </Button>
        </div>
      </section>

      {status && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            statusError ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {status}
        </div>
      )}

      <div className='flex items-center justify-between text-xs text-slate-400'>
        <span>{filteredResources.length} 个资源</span>
        {loading && <span>扫描中…</span>}
      </div>

      <div className='flex max-h-[390px] flex-col gap-2 overflow-y-auto pr-1'>
        {!loading && filteredResources.length === 0 ? (
          <div className='rounded-lg border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-xs text-slate-400'>
            暂未发现图片或视频资源
          </div>
        ) : (
          filteredResources.map((resource) => (
            <ResourceItem
              key={resource.id}
              resource={resource}
              downloading={Boolean(downloadingIds[resource.id])}
              previewing={previewingId === resource.id}
              onCopy={copyResourceUrl}
              onDownload={downloadResource}
              onOpen={openResource}
              onTogglePreview={togglePreview}
            />
          ))
        )}
      </div>
    </div>
  )
}
