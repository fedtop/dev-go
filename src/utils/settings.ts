/**
 * 扩展设置（基于 WXT storage，跨页面共享、持久化）。
 */

export type TranslateProvider = 'microsoft' | 'google'

/** 查词引擎（popup 顶部查词框用，含有道） */
export type LookupProvider = 'youdao' | 'microsoft' | 'google'

/** 网页翻译引擎：默认微软（国内可直连、免费、无需翻墙） */
export const translateProvider = storage.defineItem<TranslateProvider>('local:translateProvider', {
  fallback: 'microsoft',
})

/** 查词引擎：默认有道（含音标、释义最全） */
export const lookupProvider = storage.defineItem<LookupProvider>('local:lookupProvider', {
  fallback: 'youdao',
})

/** 划词翻译：选中文本后显示翻译按钮（默认开启） */
export const enableSelectionTranslate = storage.defineItem<boolean>(
  'local:enableSelectionTranslate',
  { fallback: true },
)

/** GitHub 增强：在线编辑按钮 + 回到顶部 + 逗号快捷键（默认开启） */
export const enableGithubEnhance = storage.defineItem<boolean>('local:enableGithubEnhance', {
  fallback: true,
})

/** 开发调试：为网页 XHR/fetch 响应补充 CORS 头（默认关闭） */
export const enableCorsBypass = storage.defineItem<boolean>('local:enableCorsBypass', {
  fallback: false,
})

/* -------------------------------- 网络面板 -------------------------------- */

/** 网络模式：直连 / 系统代理 / 情境模式 */
export type NetworkMode = 'direct' | 'system' | 'scenario'

/** 情境模式代理协议 */
export type NetworkProxyScheme = 'http' | 'https' | 'socks4' | 'socks5'

/** 情境模式代理配置 */
export interface NetworkProxyProfile {
  scheme: NetworkProxyScheme
  host: string
  port: number
  bypassList: string[]
}

/** 情境模式规则列表格式 */
export type NetworkRuleListFormat = 'AutoProxy'

/** 情境模式规则列表配置 */
export interface NetworkRuleListConfig {
  enabled: boolean
  format: NetworkRuleListFormat
  url: string
  text: string
  lastUpdate: string
  proxyRuleCount: number
  directRuleCount: number
}

export const DEFAULT_NETWORK_PROXY_PROFILE: NetworkProxyProfile = {
  scheme: 'http',
  host: '127.0.0.1',
  port: 7890,
  bypassList: ['<local>'],
}

export const DEFAULT_NETWORK_RULE_LIST: NetworkRuleListConfig = {
  enabled: false,
  format: 'AutoProxy',
  url: '',
  text: '',
  lastUpdate: '',
  proxyRuleCount: 0,
  directRuleCount: 0,
}

/** 是否由 DevGo 接管浏览器代理配置（用户首次在网络面板应用后开启） */
export const networkProxyManaged = storage.defineItem<boolean>('local:networkProxyManaged', {
  fallback: false,
})

/** 当前网络模式 */
export const networkMode = storage.defineItem<NetworkMode>('local:networkMode', {
  fallback: 'system',
})

/** 情境模式的固定代理配置 */
export const networkProxyProfile = storage.defineItem<NetworkProxyProfile>(
  'local:networkProxyProfile',
  {
    fallback: DEFAULT_NETWORK_PROXY_PROFILE,
  },
)

/** 情境模式规则列表：启用后命中规则走代理，未命中直连 */
export const networkRuleList = storage.defineItem<NetworkRuleListConfig>('local:networkRuleList', {
  fallback: DEFAULT_NETWORK_RULE_LIST,
})

/* ------------------------------- 新标签页 ------------------------------- */

/** 主题模式：自动（按本地时间） / 浅色 / 深色 */
export type ThemeMode = 'auto' | 'light' | 'dark'
export type StoredThemeMode = ThemeMode | 'system'

/** 快捷导航卡片 */
export interface QuickNavItem {
  id: string
  title: string
  url: string
}

/** 新标签页当前搜索引擎 id（见 features/newtab/engines.ts，默认 google） */
export const searchEngine = storage.defineItem<string>('local:searchEngine', {
  fallback: 'google',
})

/** 快捷导航卡片列表（为空时由 newtab 落库默认开发者站点） */
export const quickNavItems = storage.defineItem<QuickNavItem[]>('local:quickNavItems', {
  fallback: [],
})

/** 主题模式：默认自动（18:00-06:00 深色，其余浅色） */
export const themeMode = storage.defineItem<StoredThemeMode>('local:themeMode', {
  fallback: 'auto',
})
