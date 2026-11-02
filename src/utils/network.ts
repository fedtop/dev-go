import type { NetworkProxyProfile } from '@/utils/settings'

type NetworkRuleAction = 'proxy' | 'direct'
type NetworkRuleKind =
  'host-suffix' | 'host-wildcard' | 'url-wildcard' | 'url-prefix' | 'regex' | 'keyword'

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

const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i
const WILDCARD_SCHEME_RE = /^\*:\/\//i
const IPV4_CIDR_RE = /^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/
const IPV6_CIDR_RE = /^\[?[0-9a-f:]+\]?\/\d{1,3}$/i

function trimWrappingQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '')
}

function isCidrBypassPattern(value: string): boolean {
  return IPV4_CIDR_RE.test(value) || IPV6_CIDR_RE.test(value)
}

function stripPortFromHostPattern(value: string): string {
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end >= 0 ? value.slice(0, end + 1) : value
  }

  return value.replace(/:\d+$/, '')
}

function normalizeHostPattern(value: string): string {
  const host = stripPortFromHostPattern(value.trim()).replace(/\.+$/g, '').toLowerCase()
  if (host.startsWith('.')) return `*${host}`
  return host
}

function extractHostPatternFromUrlLike(value: string): string | null {
  let urlInput = `http://${value}`
  if (WILDCARD_SCHEME_RE.test(value)) {
    urlInput = value.replace(WILDCARD_SCHEME_RE, 'http://')
  } else if (URL_SCHEME_RE.test(value)) {
    urlInput = value
  }

  try {
    const url = new URL(urlInput)
    // URL 会把通配符 `*` 编码成 `%2A`，还原后才能作为通配规则使用
    return normalizeHostPattern(url.hostname.replace(/%2a/gi, '*'))
  } catch {
    const withoutScheme = value.replace(WILDCARD_SCHEME_RE, '').replace(URL_SCHEME_RE, '')
    const host = withoutScheme.startsWith('[')
      ? withoutScheme.slice(0, withoutScheme.indexOf(']') + 1 || undefined)
      : withoutScheme.split(/[/?#]/)[0]
    return host ? normalizeHostPattern(host) : null
  }
}

function normalizeBypassPattern(value: string): string | null {
  const raw = trimWrappingQuotes(value.trim())
  if (!raw) return null
  if (raw.toLowerCase() === '<local>') return '<local>'
  if (isCidrBypassPattern(raw)) return raw.toLowerCase()

  return extractHostPatternFromUrlLike(raw)
}

export function normalizeBypassList(value: string[] | string): string[] {
  const items = Array.isArray(value) ? value : value.split(/[\n,]+/)
  return Array.from(
    new Set(
      items
        .map((item) => normalizeBypassPattern(item))
        .filter((item): item is string => Boolean(item)),
    ),
  )
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

/** 能被 JS 编译的正则源码才保留：PAC 里任何一条坏正则都会让整个脚本失效 */
function isValidRegexSource(source: string): boolean {
  try {
    new RegExp(source)
    return true
  } catch {
    return false
  }
}

/**
 * AutoProxy 正则规则：`/pattern/`。正则里可能出现 `$`，不能按 `$` 截掉选项；
 * gfwlist 里还有漏写结尾 `/` 的条目（如 `@@/^https?:\/\/...\.com$`），按以 `/^` 开头宽松识别。
 */
function parseAutoProxyRegexRule(line: string): ParsedNetworkRule | null {
  const action: NetworkRuleAction = line.startsWith('@@') ? 'direct' : 'proxy'
  const value = action === 'direct' ? line.slice(2) : line
  if (!value.startsWith('/')) return null

  const closed = value.length > 2 && value.endsWith('/')
  if (!closed && !value.startsWith('/^')) return null

  const source = closed ? value.slice(1, -1) : value.slice(1)
  return source && isValidRegexSource(source) ? { action, kind: 'regex', pattern: source } : null
}

function parseAutoProxyRule(line: string): ParsedNetworkRule | null {
  const regexRule = parseAutoProxyRegexRule(line)
  if (regexRule) return regexRule

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

/** 自动模式下未命中任何规则的请求怎么走 */
export type NetworkScenarioDefaultAction = 'direct' | 'proxy'

export interface NetworkPacOptions {
  /** 用户指定始终走代理的域名（优先于规则列表） */
  proxyList?: string[]
  /** 未命中规则时的去向，默认直连 */
  defaultAction?: NetworkScenarioDefaultAction
}

/**
 * 用户填写的域名规则（绕过列表 / 自定义代理列表）：`example.com` 匹配自身及所有子域名，
 * 含 `*` 的按通配符匹配主机名；IPv4 CIDR 单独处理，只对 IP 字面量生效。
 */
function parseUserHostPattern(
  pattern: string,
  action: NetworkRuleAction,
): ParsedNetworkRule | null {
  const value = pattern.trim().toLowerCase()
  if (!value || value === '<local>' || isCidrBypassPattern(value)) return null

  const host = value.replace(/^\*\./, '')
  if (host.includes('*')) return { action, kind: 'host-wildcard', pattern: host }
  return { action, kind: 'host-suffix', pattern: normalizeHostRule(host) }
}

/** 规范化自定义代理列表：只保留域名 / 通配符，去重 */
export function normalizeProxyList(value: string[] | string): string[] {
  return normalizeBypassList(value).filter(
    (item) => item !== '<local>' && !isCidrBypassPattern(item),
  )
}

function escapeRegex(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')
}

function wildcardSource(pattern: string): string {
  return pattern.split('*').map(escapeRegex).join('.*')
}

/** 规则在 PAC 里的匹配形态：字符串类走快速比较，其余预先转成正则源码 */
interface PacRuleGroups {
  hostSuffixes: string[]
  hostRegexps: string[]
  urlPrefixes: string[]
  urlRegexps: string[]
  keywords: string[]
}

function groupRules(rules: ParsedNetworkRule[]): PacRuleGroups {
  const groups: PacRuleGroups = {
    hostSuffixes: [],
    hostRegexps: [],
    urlPrefixes: [],
    urlRegexps: [],
    keywords: [],
  }

  rules.forEach(({ kind, pattern }) => {
    switch (kind) {
      case 'host-suffix':
        groups.hostSuffixes.push(pattern)
        break
      case 'host-wildcard':
        // 通配主机名同样覆盖子域名：`cdn*.example.com` 也匹配 `a.cdn1.example.com`
        groups.hostRegexps.push(`(?:^|\\.)${wildcardSource(pattern)}$`)
        break
      case 'url-prefix':
        // `|http://*.example.com/` 这类带通配符的前缀不能按字符串前缀比较
        if (pattern.includes('*')) groups.urlRegexps.push(`^${wildcardSource(pattern)}`)
        else groups.urlPrefixes.push(pattern)
        break
      case 'url-wildcard':
        // AutoProxy 普通通配规则是「包含」语义，不锚定首尾
        groups.urlRegexps.push(wildcardSource(pattern))
        break
      case 'regex':
        groups.urlRegexps.push(pattern)
        break
      default:
        groups.keywords.push(pattern)
    }
  })

  return groups
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

/** 绕过列表里的 IPv4 CIDR → [网络号, 掩码]（PAC 里只比较 IP 字面量，不做 DNS 解析） */
function parseIpv4Cidrs(patterns: string[]): Array<[number, number]> {
  return patterns.flatMap((pattern): Array<[number, number]> => {
    const [ip, bits] = pattern.split('/')
    const base = ipv4ToNumber(ip)
    const prefix = Number(bits)
    if (base == null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return []
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
    return [[(base & mask) >>> 0, mask]]
  })
}

/**
 * 生成自动模式的 PAC 脚本。判定顺序（先命中先返回）：
 * 1. 本地地址（`<local>`：无点主机名、localhost、回环与局域网 IP）、绕过列表 → 直连
 * 2. 自定义代理列表 → 代理
 * 3. 规则列表的 `@@` 例外 → 直连
 * 4. 规则列表的代理规则 → 代理
 * 5. 未命中：默认直连；或默认代理（此时 .cn 域名仍直连）
 *
 * 正则在脚本加载时一次性编译，单次请求只做比较。
 */
export function buildNetworkPacScript(
  profile: NetworkProxyProfile,
  ruleListText: string,
  options: NetworkPacOptions = {},
): { data: string; proxyRuleCount: number; directRuleCount: number } {
  const normalized = normalizeNetworkProxyProfile(profile)
  const parsed: ParsedNetworkRuleList = ruleListText.trim()
    ? parseNetworkRuleList(ruleListText)
    : { proxyRules: [], directRules: [], skipped: 0 }
  const toRules = (patterns: string[], action: NetworkRuleAction) =>
    patterns
      .map((pattern) => parseUserHostPattern(pattern, action))
      .filter((rule): rule is ParsedNetworkRule => Boolean(rule))

  const config = {
    proxy: proxyDirective(normalized),
    defaultProxy: options.defaultAction === 'proxy',
    bypassLocal: normalized.bypassList.includes('<local>'),
    bypassCidrs: parseIpv4Cidrs(normalized.bypassList.filter(isCidrBypassPattern)),
    bypass: groupRules(toRules(normalized.bypassList, 'direct')),
    userProxy: groupRules(toRules(normalizeProxyList(options.proxyList ?? []), 'proxy')),
    listDirect: groupRules(parsed.directRules),
    listProxy: groupRules(parsed.proxyRules),
  }

  const data = String.raw`
var CONFIG = ${JSON.stringify(config)};
var PROXY_RESULT = CONFIG.proxy;
var DIRECT_RESULT = "DIRECT";
var IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
/* 回环 127/8、局域网 10/8 172.16/12 192.168/16、链路本地 169.254/16 */
var LOCAL_CIDRS = [[2130706432, 4278190080], [167772160, 4278190080], [2886729728, 4293918720], [3232235520, 4294901760], [2851995648, 4294901760]];

function compileGroups(groups) {
  function compile(sources) {
    var list = [];
    for (var i = 0; i < sources.length; i += 1) {
      try { list.push(new RegExp(sources[i], "i")); } catch (e) {}
    }
    return list;
  }
  return {
    hostSuffixes: groups.hostSuffixes,
    hostRegexps: compile(groups.hostRegexps),
    urlPrefixes: groups.urlPrefixes,
    urlRegexps: compile(groups.urlRegexps),
    keywords: groups.keywords
  };
}

var BYPASS = compileGroups(CONFIG.bypass);
var USER_PROXY = compileGroups(CONFIG.userProxy);
var LIST_DIRECT = compileGroups(CONFIG.listDirect);
var LIST_PROXY = compileGroups(CONFIG.listProxy);

function ipv4ToNumber(host) {
  var parts = host.split(".");
  return ((parseInt(parts[0], 10) << 24) >>> 0) + (parseInt(parts[1], 10) << 16) + (parseInt(parts[2], 10) << 8) + parseInt(parts[3], 10);
}

function inCidrs(value, cidrs) {
  for (var i = 0; i < cidrs.length; i += 1) {
    if (((value & cidrs[i][1]) >>> 0) === cidrs[i][0]) return true;
  }
  return false;
}

function matchesGroups(host, url, groups) {
  var i;
  for (i = 0; i < groups.hostSuffixes.length; i += 1) {
    var suffix = groups.hostSuffixes[i];
    if (host === suffix || (host.length > suffix.length && host.slice(-suffix.length - 1) === "." + suffix)) return true;
  }
  for (i = 0; i < groups.hostRegexps.length; i += 1) {
    if (groups.hostRegexps[i].test(host)) return true;
  }
  for (i = 0; i < groups.urlPrefixes.length; i += 1) {
    if (url.indexOf(groups.urlPrefixes[i]) === 0) return true;
  }
  for (i = 0; i < groups.urlRegexps.length; i += 1) {
    if (groups.urlRegexps[i].test(url)) return true;
  }
  for (i = 0; i < groups.keywords.length; i += 1) {
    if (url.indexOf(groups.keywords[i]) >= 0) return true;
  }
  return false;
}

function FindProxyForURL(url, host) {
  host = String(host || "").toLowerCase().replace(/\.$/, "");
  url = String(url || "").toLowerCase();

  var ipv4 = IPV4_RE.test(host) ? ipv4ToNumber(host) : null;
  if (CONFIG.bypassLocal) {
    if (host.indexOf(".") < 0 || host === "localhost") return DIRECT_RESULT;
    if (ipv4 !== null && inCidrs(ipv4, LOCAL_CIDRS)) return DIRECT_RESULT;
  }
  if (ipv4 !== null && inCidrs(ipv4, CONFIG.bypassCidrs)) return DIRECT_RESULT;
  if (matchesGroups(host, url, BYPASS)) return DIRECT_RESULT;
  if (matchesGroups(host, url, USER_PROXY)) return PROXY_RESULT;
  if (matchesGroups(host, url, LIST_DIRECT)) return DIRECT_RESULT;
  if (matchesGroups(host, url, LIST_PROXY)) return PROXY_RESULT;

  if (CONFIG.defaultProxy) {
    return host.slice(-3) === ".cn" ? DIRECT_RESULT : PROXY_RESULT;
  }
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
