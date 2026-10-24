/**
 * 网络面板的常量与纯函数（不依赖 React / 浏览器 API）。
 */
import type { NetworkProxyStatus } from '@/utils/messaging'
import { normalizeBypassList } from '@/utils/network'
import {
  DEFAULT_NETWORK_PROXY_PROFILE,
  type NetworkCustomProxyModeProfile,
  type NetworkMode,
  type NetworkProxyProfile,
  type NetworkProxyProfileMode,
  type NetworkProxyScheme,
} from '@/utils/settings'

export const MODE_OPTIONS: Array<{ value: NetworkMode; label: string; description: string }> = [
  { value: 'direct', label: '直连', description: '不使用代理' },
  { value: 'system', label: '系统代理', description: '跟随系统设置' },
  { value: 'scenario', label: '自动模式', description: '规则自动切换' },
  { value: 'global', label: '代理模式', description: '全部走代理' },
]

export const SCHEME_OPTIONS: Array<{ value: NetworkProxyScheme; label: string }> = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks4', label: 'SOCKS4' },
  { value: 'socks5', label: 'SOCKS5' },
]

/** 代理模式与自动模式都依赖下方填写的固定代理（host/port/绕过列表） */
export function usesProxyProfile(mode: NetworkMode): boolean {
  return mode === 'global' || mode === 'scenario'
}

const CONTROL_LABELS: Record<string, string> = {
  not_controllable: '浏览器不允许扩展控制代理',
  controlled_by_other_extensions: '代理已被其他扩展控制',
  controllable_by_this_extension: '可由 DevGo 控制',
  controlled_by_this_extension: '已由 DevGo 控制',
}

export const RECOMMENDED_RULE_LISTS = [
  {
    label: '规则 1 · GitHub',
    url: 'https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt',
  },
  {
    label: '规则 2 · GitLab',
    url: 'https://gitlab.com/gfwlist/gfwlist/raw/master/gfwlist.txt',
  },
  {
    label: '规则 3 · jsDelivr',
    url: 'https://cdn.jsdelivr.net/gh/gfwlist/gfwlist@master/gfwlist.txt',
  },
  {
    label: '规则 4 · Pagure',
    url: 'https://pagure.io/gfwlist/raw/master/f/gfwlist.txt',
  },
]

export const CUSTOM_PROXY_MODE_NAME_MAX = 24

export function createDefaultProxyProfile(): NetworkProxyProfile {
  return {
    ...DEFAULT_NETWORK_PROXY_PROFILE,
    bypassList: [...DEFAULT_NETWORK_PROXY_PROFILE.bypassList],
  }
}

export function getDefaultBypassText(): string {
  return DEFAULT_NETWORK_PROXY_PROFILE.bypassList.join('\n')
}

export function normalizeCustomProxyModeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, CUSTOM_PROXY_MODE_NAME_MAX)
}

export function uniqueCustomProxyModeName(
  name: string,
  modes: NetworkCustomProxyModeProfile[],
): string {
  const used = new Set(modes.map((item) => item.name))
  if (!used.has(name)) return name

  for (let index = 2; index < 100; index += 1) {
    const next = `${name} ${index}`
    if (!used.has(next)) return next
  }

  return `${name} ${Date.now()}`
}

export function createCustomProxyModeSnapshot(
  name: string,
  proxyProfile: NetworkProxyProfile,
): NetworkCustomProxyModeProfile {
  return {
    id: crypto.randomUUID(),
    name,
    proxyProfile,
    updatedAt: new Date().toISOString(),
  }
}

export function nextCustomProxyModeIdOrEmpty(
  modes: NetworkCustomProxyModeProfile[],
  activeId: string,
): string {
  return modes.some((item) => item.id === activeId) ? activeId : ''
}

export function normalizeProfileFromForm(
  profile: NetworkProxyProfile,
  bypassText: string,
): NetworkProxyProfile {
  return {
    ...profile,
    host: profile.host.trim(),
    port: Number.isFinite(profile.port) ? Math.trunc(profile.port) : 0,
    bypassList: normalizeBypassList(bypassText),
  }
}

export function proxyProfileModeOf(mode: NetworkMode): NetworkProxyProfileMode | null {
  if (mode === 'global' || mode === 'scenario') return mode
  return null
}

export function getStatusText(status: NetworkProxyStatus | null): string {
  if (!status) return ''
  if (!status.ok) return status.error || '代理设置失败'
  return status.levelOfControl ? CONTROL_LABELS[status.levelOfControl] : '代理设置已同步'
}

export function formatRuleListTime(value: string): string {
  if (!value) return ''

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return ''
  }
}
