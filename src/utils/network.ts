import type { NetworkProxyProfile } from '@/utils/settings'

type NetworkRuleAction = 'proxy' | 'direct'
type NetworkRuleKind = 'host-suffix' | 'host-wildcard' | 'url-wildcard' | 'url-prefix' | 'keyword'

export interface ParsedNetworkRule {
  action: NetworkRuleAction
  kind: NetworkRuleKind
  pattern: string
}

export interface ParsedNetworkRuleList {
  proxyRules: ParsedNetworkRule[]
  directRules: ParsedNetworkRule[]
  skipped: number
}

export function normalizeBypassList(value: string[] | string): string[] {
  const items = Array.isArray(value) ? value : value.split(/[\n,]+/)
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))
}

export function normalizeNetworkProxyProfile(profile: NetworkProxyProfile): NetworkProxyProfile {
  return {
    scheme: profile.scheme,
    host: profile.host.trim(),
    port: Number.isFinite(profile.port) ? Math.trunc(profile.port) : 0,
    bypassList: normalizeBypassList(profile.bypassList),
  }
}

export function isValidNetworkProxyProfile(profile: NetworkProxyProfile): boolean {
  const normalized = normalizeNetworkProxyProfile(profile)
  return normalized.host.length > 0 && normalized.port > 0 && normalized.port <= 65535
}

export function formatNetworkProxy(profile: NetworkProxyProfile): string {
  const normalized = normalizeNetworkProxyProfile(profile)
  return `${normalized.scheme}://${normalized.host}:${normalized.port}`
}

function decodeBase64Text(value: string): string | null {
  const compact = value.trim().replace(/\s+/g, '')
  if (!compact || compact.length < 16 || !/^[A-Za-z0-9+/=_-]+$/.test(compact)) return null

  try {
    const normalized = compact.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return decodeURIComponent(
      Array.from(
        atob(padded),
        (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
      ).join(''),
    )
  } catch {
    try {
      return atob(compact)
    } catch {
      return null
    }
  }
}

export function decodeNetworkRuleListText(value: string): string {
  const decoded = decodeBase64Text(value)
  if (!decoded) return value

  return /\[AutoProxy|\|\||^!/m.test(decoded) ? decoded : value
}

function trimAutoProxySeparator(value: string): string {
  return value.replace(/\^+$/g, '').trim()
}

function normalizeHostRule(value: string): string {
  return trimAutoProxySeparator(value)
    .replace(/^\*+\./, '')
    .replace(/^\.+/, '')
    .toLowerCase()
}

function looksLikeHostRule(value: string): boolean {
  return /^[a-z0-9*_.:-]+$/i.test(value) && value.includes('.')
}

function normalizeAutoProxyLine(line: string): string {
  const optionIndex = line.indexOf('$')
  return trimAutoProxySeparator(optionIndex >= 0 ? line.slice(0, optionIndex) : line)
}

function parseAutoProxyRule(line: string): ParsedNetworkRule | null {
  let value = normalizeAutoProxyLine(line)
  if (!value || value.startsWith('!') || value.startsWith('[')) return null

  const action: NetworkRuleAction = value.startsWith('@@') ? 'direct' : 'proxy'
  if (action === 'direct') {
    value = value.slice(2)
  }

  if (!value) return null

  if (value.startsWith('||')) {
    const host = normalizeHostRule(value.slice(2).split(/[/?#]/)[0])
    if (!host) return null
    return {
      action,
      kind: host.includes('*') ? 'host-wildcard' : 'host-suffix',
      pattern: host,
    }
  }

  if (value.startsWith('|')) {
    const prefix = value.replace(/^\|/, '').replace(/\|$/, '')
    if (!prefix) return null
    return { action, kind: 'url-prefix', pattern: prefix.toLowerCase() }
  }

  if (value.startsWith('.') || value.startsWith('*.')) {
    const host = normalizeHostRule(value)
    if (!host) return null
    return {
      action,
      kind: host.includes('*') ? 'host-wildcard' : 'host-suffix',
      pattern: host,
    }
  }

  if (looksLikeHostRule(value)) {
    const host = normalizeHostRule(value)
    if (!host) return null
    return {
      action,
      kind: host.includes('*') ? 'host-wildcard' : 'host-suffix',
      pattern: host,
    }
  }

  if (value.includes('://') || value.includes('*')) {
    return { action, kind: 'url-wildcard', pattern: value.toLowerCase() }
  }

  return { action, kind: 'keyword', pattern: value.toLowerCase() }
}

function uniqueRules(rules: ParsedNetworkRule[]): ParsedNetworkRule[] {
  const seen = new Set<string>()
  return rules.filter((rule) => {
    const key = `${rule.action}:${rule.kind}:${rule.pattern}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function parseNetworkRuleList(value: string): ParsedNetworkRuleList {
  const text = decodeNetworkRuleListText(value)
  const proxyRules: ParsedNetworkRule[] = []
  const directRules: ParsedNetworkRule[] = []
  let skipped = 0

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line || line.startsWith('!') || line.startsWith('[')) return

    const rule = parseAutoProxyRule(line)
    if (!rule) {
      skipped += 1
      return
    }

    if (rule.action === 'direct') {
      directRules.push(rule)
      return
    }

    proxyRules.push(rule)
  })

  return {
    proxyRules: uniqueRules(proxyRules),
    directRules: uniqueRules(directRules),
    skipped,
  }
}

function proxyDirective(profile: NetworkProxyProfile): string {
  const normalized = normalizeNetworkProxyProfile(profile)
  const target = `${normalized.host}:${normalized.port}`

  if (normalized.scheme === 'https') return `HTTPS ${target}`
  if (normalized.scheme === 'socks4') return `SOCKS ${target}`
  if (normalized.scheme === 'socks5') return `SOCKS5 ${target}`
  return `PROXY ${target}`
}

function parseBypassPattern(pattern: string): ParsedNetworkRule | null {
  const value = pattern.trim()
  if (!value || value === '<local>') return null

  if (value.includes('*')) {
    return {
      action: 'direct',
      kind: 'host-wildcard',
      pattern: value.toLowerCase(),
    }
  }

  return {
    action: 'direct',
    kind: 'host-suffix',
    pattern: normalizeHostRule(value),
  }
}

function groupRules(rules: ParsedNetworkRule[]) {
  return {
    hostSuffixes: rules.filter((rule) => rule.kind === 'host-suffix').map((rule) => rule.pattern),
    hostWildcards: rules
      .filter((rule) => rule.kind === 'host-wildcard')
      .map((rule) => rule.pattern),
    urlWildcards: rules.filter((rule) => rule.kind === 'url-wildcard').map((rule) => rule.pattern),
    urlPrefixes: rules.filter((rule) => rule.kind === 'url-prefix').map((rule) => rule.pattern),
    keywords: rules.filter((rule) => rule.kind === 'keyword').map((rule) => rule.pattern),
  }
}

export function buildNetworkPacScript(
  profile: NetworkProxyProfile,
  ruleListText: string,
): { data: string; proxyRuleCount: number; directRuleCount: number } {
  const normalized = normalizeNetworkProxyProfile(profile)
  const parsed = parseNetworkRuleList(ruleListText)
  const bypassRules = normalized.bypassList
    .map(parseBypassPattern)
    .filter((rule): rule is ParsedNetworkRule => Boolean(rule))
  const directGroups = groupRules([...parsed.directRules, ...bypassRules])
  const proxyGroups = groupRules(parsed.proxyRules)
  const bypassLocal = normalized.bypassList.includes('<local>')

  const data = String.raw`
var PROXY_RESULT = ${JSON.stringify(proxyDirective(normalized))};
var DIRECT_RESULT = "DIRECT";
var BYPASS_LOCAL = ${JSON.stringify(bypassLocal)};
var DIRECT_HOST_SUFFIXES = ${JSON.stringify(directGroups.hostSuffixes)};
var DIRECT_HOST_WILDCARDS = ${JSON.stringify(directGroups.hostWildcards)};
var DIRECT_URL_WILDCARDS = ${JSON.stringify(directGroups.urlWildcards)};
var DIRECT_URL_PREFIXES = ${JSON.stringify(directGroups.urlPrefixes)};
var DIRECT_KEYWORDS = ${JSON.stringify(directGroups.keywords)};
var PROXY_HOST_SUFFIXES = ${JSON.stringify(proxyGroups.hostSuffixes)};
var PROXY_HOST_WILDCARDS = ${JSON.stringify(proxyGroups.hostWildcards)};
var PROXY_URL_WILDCARDS = ${JSON.stringify(proxyGroups.urlWildcards)};
var PROXY_URL_PREFIXES = ${JSON.stringify(proxyGroups.urlPrefixes)};
var PROXY_KEYWORDS = ${JSON.stringify(proxyGroups.keywords)};

function wildcardToRegExp(pattern) {
  return new RegExp("^" + pattern.replace(/[.+?^$(){}|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

function matchesHostSuffix(host, suffixes) {
  for (var i = 0; i < suffixes.length; i += 1) {
    if (host === suffixes[i] || dnsDomainIs(host, "." + suffixes[i])) return true;
  }
  return false;
}

function matchesWildcard(value, patterns) {
  for (var i = 0; i < patterns.length; i += 1) {
    if (wildcardToRegExp(patterns[i]).test(value)) return true;
  }
  return false;
}

function matchesPrefix(value, prefixes) {
  for (var i = 0; i < prefixes.length; i += 1) {
    if (value.indexOf(prefixes[i]) === 0) return true;
  }
  return false;
}

function matchesKeyword(value, keywords) {
  for (var i = 0; i < keywords.length; i += 1) {
    if (value.indexOf(keywords[i]) >= 0) return true;
  }
  return false;
}

function matchesRuleGroups(host, url, groups) {
  return matchesHostSuffix(host, groups.hostSuffixes) ||
    matchesWildcard(host, groups.hostWildcards) ||
    matchesWildcard(url, groups.urlWildcards) ||
    matchesPrefix(url, groups.urlPrefixes) ||
    matchesKeyword(url, groups.keywords);
}

function FindProxyForURL(url, host) {
  host = String(host || "").toLowerCase();
  url = String(url || "").toLowerCase();

  if (BYPASS_LOCAL && isPlainHostName(host)) return DIRECT_RESULT;
  if (matchesRuleGroups(host, url, {
    hostSuffixes: DIRECT_HOST_SUFFIXES,
    hostWildcards: DIRECT_HOST_WILDCARDS,
    urlWildcards: DIRECT_URL_WILDCARDS,
    urlPrefixes: DIRECT_URL_PREFIXES,
    keywords: DIRECT_KEYWORDS
  })) return DIRECT_RESULT;
  if (matchesRuleGroups(host, url, {
    hostSuffixes: PROXY_HOST_SUFFIXES,
    hostWildcards: PROXY_HOST_WILDCARDS,
    urlWildcards: PROXY_URL_WILDCARDS,
    urlPrefixes: PROXY_URL_PREFIXES,
    keywords: PROXY_KEYWORDS
  })) return PROXY_RESULT;

  return DIRECT_RESULT;
}
`.trim()

  return {
    data,
    proxyRuleCount: parsed.proxyRules.length,
    directRuleCount: parsed.directRules.length,
  }
}

export function getUrlHostname(url?: string): string {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.hostname : ''
  } catch {
    return ''
  }
}
