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
  type NetworkPacOptions,
} from '@/utils/network'
import {
  getNetworkProxyProfileForMode,
  networkActiveCustomProxyModeId,
  networkCustomProxyModeProfiles,
  networkGlobalProxyProfile,
  networkMode,
  networkProxyManaged,
  networkRuleList,
  networkScenarioDefaultAction,
  networkScenarioProxyList,
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

const RULE_LIST_REFRESH_ALARM = 'devgo-rule-list-refresh'
const RULE_LIST_REFRESH_MINUTES = 6 * 60
/** 规则列表超过这个时长未更新时自动重新下载（gfwlist 自身声明 6 小时过期） */
const RULE_LIST_MAX_AGE_MS = 6 * 60 * 60 * 1000 - 10 * 60 * 1000

async function readScenarioOptions(): Promise<NetworkPacOptions> {
  const [proxyList, defaultAction] = await Promise.all([
    networkScenarioProxyList.getValue(),
    networkScenarioDefaultAction.getValue(),
  ])
  return { proxyList, defaultAction }
}

/**
 * 自动模式：规则列表启用、有自定义代理域名或未命中默认走代理时，生成 PAC 按规则分流；
 * 三者都没有时没有任何命中代理的依据，按未命中的默认去向全部直连。
 */
function buildNetworkProxyConfig(
  mode: NetworkMode,
  profile: NetworkProxyProfile,
  ruleList: NetworkRuleListConfig,
  scenario: NetworkPacOptions,
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

  const ruleListActive = ruleList.enabled && Boolean(ruleList.text.trim())
  if (ruleListActive || scenario.proxyList?.length || scenario.defaultAction === 'proxy') {
    const pacScript = buildNetworkPacScript(profile, ruleListActive ? ruleList.text : '', scenario)

    return {
      mode: 'pac_script',
      pacScript: {
        data: pacScript.data,
        mandatory: false,
      },
    }
  }

  return { mode: 'direct' }
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
    const [profile, ruleList, scenario] = await Promise.all([
      getNetworkProxyProfileForMode(mode),
      networkRuleList.getValue(),
      readScenarioOptions(),
    ])
    await setChromeProxyConfig(buildNetworkProxyConfig(mode, profile, ruleList, scenario))
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
    const [mode, ruleList, scenario] = await Promise.all([
      networkMode.getValue(),
      networkRuleList.getValue(),
      readScenarioOptions(),
    ])
    const profile = await getNetworkProxyProfileForMode(mode)
    await setChromeProxyConfig(buildNetworkProxyConfig(mode, profile, ruleList, scenario))
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

/** 已启用的规则列表超过有效期时重新下载；失败保留旧规则，下次定时再试 */
async function refreshRuleListIfStale(): Promise<void> {
  const ruleList = await networkRuleList.getValue()
  if (!ruleList.enabled || !ruleList.url.trim()) return

  const updatedAt = Date.parse(ruleList.lastUpdate)
  if (Number.isFinite(updatedAt) && Date.now() - updatedAt < RULE_LIST_MAX_AGE_MS) return

  const result = await downloadNetworkRuleList(ruleList.url)
  if (!result.ok) console.warn('[DevGo] refresh rule list failed:', result.error)
}

function refreshRuleListSafely() {
  refreshRuleListIfStale().catch((error) => {
    console.warn('[DevGo] refresh rule list failed:', error)
  })
}

/** 定时检查规则列表：闹钟已存在时不重建，否则 SW 每次被唤醒都会重置计时 */
function scheduleRuleListRefresh() {
  if (!chrome.alarms) return
  chrome.alarms.get(RULE_LIST_REFRESH_ALARM, (alarm) => {
    if (alarm) return
    chrome.alarms.create(RULE_LIST_REFRESH_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: RULE_LIST_REFRESH_MINUTES,
    })
  })
}

/** 网络相关设置变化时重新应用代理（各设置项 watcher 需在 SW 启动时同步注册） */
export function registerProxyWatchers() {
  networkMode.watch(syncNetworkProxySafely)
  networkGlobalProxyProfile.watch(syncNetworkProxySafely)
  networkScenarioProxyProfile.watch(syncNetworkProxySafely)
  networkCustomProxyModeProfiles.watch(syncNetworkProxySafely)
  networkActiveCustomProxyModeId.watch(syncNetworkProxySafely)
  networkRuleList.watch(syncNetworkProxySafely)
  networkScenarioProxyList.watch(syncNetworkProxySafely)
  networkScenarioDefaultAction.watch(syncNetworkProxySafely)

  chrome.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === RULE_LIST_REFRESH_ALARM) refreshRuleListSafely()
  })
  scheduleRuleListRefresh()

  chrome.proxy?.onProxyError?.addListener((details) => {
    console.warn('[DevGo] proxy error:', details)
  })
}
