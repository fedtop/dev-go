/**
 * 网络代理：把网络面板的模式与配置应用到 chrome.proxy，并下载 AutoProxy 规则列表。
 */

import { ensureStorageMigrated } from '@/background/migration'
import type { NetworkProxyStatus, NetworkRuleListDownloadStatus } from '@/utils/messaging'
import {
  buildNetworkPacScript,
  decodeNetworkRuleListText,
  normalizeNetworkProxyProfile,
  parseNetworkRuleList,
} from '@/utils/network'
import {
  getNetworkProxyProfileForMode,
  networkActiveCustomProxyModeId,
  networkCustomProxyModeProfiles,
  networkGlobalProxyProfile,
  networkMode,
  networkProxyManaged,
  networkRuleList,
  networkScenarioProxyProfile,
  type NetworkMode,
  type NetworkProxyProfile,
  type NetworkRuleListConfig,
} from '@/utils/settings'

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

export async function getNetworkStatus(error?: unknown): Promise<NetworkProxyStatus> {
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

export async function applyNetworkMode(mode: NetworkMode): Promise<NetworkProxyStatus> {
  await networkMode.setValue(mode)
  await networkProxyManaged.setValue(true)

  try {
    const [profile, ruleList] = await Promise.all([
      getNetworkProxyProfileForMode(mode),
      networkRuleList.getValue(),
    ])
    await setChromeProxyConfig(buildNetworkProxyConfig(mode, profile, ruleList))
    return getNetworkStatus()
  } catch (error) {
    return getNetworkStatus(error)
  }
}

export async function syncNetworkProxy(): Promise<NetworkProxyStatus> {
  const managed = await networkProxyManaged.getValue()

  if (!managed) {
    return getNetworkStatus()
  }

  try {
    const [mode, ruleList] = await Promise.all([networkMode.getValue(), networkRuleList.getValue()])
    const profile = await getNetworkProxyProfileForMode(mode)
    await setChromeProxyConfig(buildNetworkProxyConfig(mode, profile, ruleList))
    return getNetworkStatus()
  } catch (error) {
    return getNetworkStatus(error)
  }
}

async function migrateThenSyncNetworkProxy(): Promise<void> {
  await ensureStorageMigrated()
  await syncNetworkProxy()
}

export function syncNetworkProxySafely() {
  migrateThenSyncNetworkProxy().catch((error) => {
    console.warn('[DevGo] sync network proxy failed:', error)
  })
}

export async function downloadNetworkRuleList(url: string): Promise<NetworkRuleListDownloadStatus> {
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

/** 网络相关设置变化时重新应用代理（各设置项 watcher 需在 SW 启动时同步注册） */
export function registerProxyWatchers() {
  networkMode.watch(syncNetworkProxySafely)
  networkGlobalProxyProfile.watch(syncNetworkProxySafely)
  networkScenarioProxyProfile.watch(syncNetworkProxySafely)
  networkCustomProxyModeProfiles.watch(syncNetworkProxySafely)
  networkActiveCustomProxyModeId.watch(syncNetworkProxySafely)
  networkRuleList.watch(syncNetworkProxySafely)

  chrome.proxy?.onProxyError?.addListener((details) => {
    console.warn('[DevGo] proxy error:', details)
  })
}
