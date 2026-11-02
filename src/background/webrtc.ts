/**
 * WebRTC 防泄露：
 * - IP 处理策略：chrome.privacy.network.webRTCIPHandlingPolicy（privacy 为可选权限，开启时申请）；
 *   关闭时 clear() 交还控制权，而不是写入 default，避免长期占用该设置。
 * - 屏蔽接口 / 隐藏媒体设备：按开关动态注册 MAIN world 内容脚本（document_start、所有 frame，
 *   含 about:blank / blob: 等继承来源的 frame），在网页脚本之前生效且不受 CSP 影响。
 */
import type { WebrtcCandidate, WebrtcLeakResult, WebrtcStatus } from '@/utils/messaging'
import {
  isWebrtcPolicy,
  webrtcBlockApis,
  webrtcHideMediaDevices,
  webrtcPolicy,
  type WebrtcPolicy,
} from '@/utils/settings'

const PRIVACY_PERMISSION = { permissions: ['privacy' as const] }
const SCRIPTS = [
  { id: 'devgo-webrtc-block-apis', file: 'webrtc-block-apis.js', item: webrtcBlockApis },
  { id: 'devgo-webrtc-hide-devices', file: 'webrtc-hide-devices.js', item: webrtcHideMediaDevices },
] as const

/** Firefox 与旧版本可能没有该设置；可选权限未授予时 chrome.privacy 也不存在 */
function policySetting() {
  return (chrome.privacy as typeof chrome.privacy | undefined)?.network?.webRTCIPHandlingPolicy
}

async function hasPrivacyPermission(): Promise<boolean> {
  return browser.permissions.contains(PRIVACY_PERMISSION).catch(() => false)
}

/** 把存储里的策略写入浏览器；没有权限时什么都不做（界面会提示授权） */
export async function applyWebrtcPolicy(): Promise<void> {
  const stored = await webrtcPolicy.getValue()
  const policy: WebrtcPolicy = isWebrtcPolicy(stored) ? stored : 'default'
  if (!(await hasPrivacyPermission())) return
  const setting = policySetting()
  if (!setting) return

  if (policy === 'default') await setting.clear({})
  else await setting.set({ value: policy })
}

/** 按开关注册 / 注销 MAIN world 脚本（注册结果由浏览器持久保存，SW 重启后无需重复注册） */
export async function syncWebrtcScripts(): Promise<void> {
  if (!chrome.scripting?.registerContentScripts) return
  const registered = new Set(
    (await chrome.scripting.getRegisteredContentScripts()).map((script) => script.id),
  )

  for (const { id, file, item } of SCRIPTS) {
    const enabled = await item.getValue()
    if (enabled && !registered.has(id)) {
      await chrome.scripting.registerContentScripts([
        {
          id,
          js: [file],
          matches: ['<all_urls>'],
          runAt: 'document_start',
          allFrames: true,
          matchOriginAsFallback: true,
          world: 'MAIN',
          persistAcrossSessions: true,
        },
      ])
    } else if (!enabled && registered.has(id)) {
      await chrome.scripting.unregisterContentScripts({ ids: [id] })
    }
  }
}

export function syncWebrtcSafely() {
  applyWebrtcPolicy().catch((error: unknown) => {
    console.warn('[DevGo] apply WebRTC policy failed:', error)
  })
  syncWebrtcScripts().catch((error: unknown) => {
    console.warn('[DevGo] sync WebRTC scripts failed:', error)
  })
}

/** 设置页展示：权限、浏览器当前生效的策略、以及是否被其他扩展接管 */
export async function getWebrtcStatus(): Promise<WebrtcStatus> {
  const setting = policySetting()
  const permission = await hasPrivacyPermission()
  // 未授权时 chrome.privacy 不存在，无法判断支持与否，按支持处理（授权后再读取）
  if (!permission) return { supported: true, permission, value: null, control: null }
  if (!setting) return { supported: false, permission, value: null, control: null }
  const details = await new Promise<{ value: string; levelOfControl: string }>((resolve) =>
    setting.get({}, (result) => resolve(result as { value: string; levelOfControl: string })),
  )
  return {
    supported: true,
    permission,
    value: details.value,
    control: details.levelOfControl,
  }
}

/** 设置变化时立即生效 */
export function registerWebrtcWatchers() {
  webrtcPolicy.watch(syncWebrtcSafely)
  webrtcBlockApis.watch(syncWebrtcSafely)
  webrtcHideMediaDevices.watch(syncWebrtcSafely)
  // 用户在设置页授予 privacy 权限后补上策略
  browser.permissions.onAdded.addListener(syncWebrtcSafely)
}

/**
 * 在网页里收集 ICE 候选（注入到网页主环境执行，不能引用外部变量）。
 * 用公共 STUN 服务器拿到公网映射地址，最多等待 6 秒。
 */
async function gatherInPage(): Promise<{ blocked: boolean; candidates: WebrtcCandidate[] }> {
  if (typeof RTCPeerConnection === 'undefined') return { blocked: true, candidates: [] }
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
  const found = new Map<string, WebrtcCandidate>()
  try {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 6000)
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          clearTimeout(timer)
          resolve()
          return
        }
        const parts = event.candidate.candidate.split(' ')
        const typeIndex = parts.indexOf('typ')
        const candidate = {
          address: parts[4] ?? '',
          protocol: (parts[2] ?? '').toLowerCase(),
          type: typeIndex >= 0 ? parts[typeIndex + 1] : 'unknown',
        }
        if (candidate.address) found.set(`${candidate.type}|${candidate.address}`, candidate)
      }
      pc.createDataChannel('devgo-leak-test')
      void pc.createOffer().then((offer) => pc.setLocalDescription(offer))
    })
  } finally {
    pc.close()
  }
  return { blocked: false, candidates: [...found.values()] }
}

/** 扩展页面不受 WebRTC 策略约束，检测必须在真实网页里进行：选最近使用的 http(s) 标签 */
export async function testWebrtcLeak(): Promise<WebrtcLeakResult> {
  const tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] })
  const tab = tabs
    .filter((item) => item.id != null && !item.discarded)
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0]
  if (!tab?.id) return { candidates: [], error: '请先打开任意一个网页（http / https），再回来检测' }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: gatherInPage,
    })
    const result = injection?.result as Awaited<ReturnType<typeof gatherInPage>> | undefined
    return {
      host: tab.url ? new URL(tab.url).host : undefined,
      candidates: result?.candidates ?? [],
      blocked: result?.blocked,
    }
  } catch (error) {
    return {
      candidates: [],
      error: `无法在 ${tab.url ? new URL(tab.url).host : '该网页'} 上检测：${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
