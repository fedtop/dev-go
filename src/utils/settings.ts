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
export const searchEngine = storage.defineItem<string>('sync:searchEngine', {
  fallback: 'google',
})

/** 快捷导航卡片列表（为空时由 newtab 落库默认开发者站点） */
export const quickNavItems = storage.defineItem<QuickNavItem[]>('sync:quickNavItems', {
  fallback: [],
})

/** 主题模式：默认自动（18:00-06:00 深色，其余浅色） */
export const themeMode = storage.defineItem<StoredThemeMode>('sync:themeMode', {
  fallback: 'auto',
})

/** 任务状态：待办 / 进行中 / 已完成 */
export type TodoStatus = 'todo' | 'doing' | 'done'

/** TODO 任务项 */
export interface TodoItem {
  id: string
  text: string
  status: TodoStatus
  createdAt: number
}

/** 新标签页 TODO 任务列表（持久化、跨设备同步，抗扩展卸载/重装） */
export const todoItems = storage.defineItem<TodoItem[]>('sync:todoItems', {
  fallback: [],
})

/**
 * popup 下次打开时要定位的 Tab（一次性信号）。
 * Alt+3 经后台写入 'todo'，popup 读取后立即清空。
 */
export const popupInitialTab = storage.defineItem<string>('local:popupInitialTab', {
  fallback: '',
})

/* ------------------------------ local → sync 迁移 ------------------------------ */

/** 迁移完成标记，确保只搬一次（即便用户清空了 sync 数据也不会反复覆盖） */
const syncMigrated = storage.defineItem<boolean>('sync:migratedFromLocal', { fallback: false })

/**
 * 把早期存于 local 的新标签页 / 待办数据搬到 sync，使其可跨设备同步、抗卸载。
 * - 仅当从未迁移过时执行（一次性）。
 * - 逐项仅在「sync 还是默认值 且 local 有有效数据」时搬运，避免覆盖更新的 sync 数据。
 * - 旧 local 数据保留不删，作为本机兜底。
 * 应在各页面渲染前 await（见各 entrypoint 的 main.tsx）。
 */
export async function migrateLocalToSync(): Promise<void> {
  if (await syncMigrated.getValue()) return

  // 这些 key 已从 local: 改为 sync:；直接读旧的 local 原始值。
  const [localTodos, localNav, localTheme, localEngine] = await Promise.all([
    storage.getItem<TodoItem[]>('local:todoItems'),
    storage.getItem<QuickNavItem[]>('local:quickNavItems'),
    storage.getItem<StoredThemeMode>('local:themeMode'),
    storage.getItem<string>('local:searchEngine'),
  ])

  const [syncTodos, syncNav, syncTheme, syncEngine] = await Promise.all([
    todoItems.getValue(),
    quickNavItems.getValue(),
    themeMode.getValue(),
    searchEngine.getValue(),
  ])

  const tasks: Promise<unknown>[] = []
  if (Array.isArray(localTodos) && localTodos.length > 0 && syncTodos.length === 0) {
    tasks.push(todoItems.setValue(localTodos))
  }
  if (Array.isArray(localNav) && localNav.length > 0 && syncNav.length === 0) {
    tasks.push(quickNavItems.setValue(localNav))
  }
  if (localTheme && syncTheme === 'auto') {
    tasks.push(themeMode.setValue(localTheme))
  }
  if (localEngine && syncEngine === 'google') {
    tasks.push(searchEngine.setValue(localEngine))
  }

  await Promise.all(tasks)
  await syncMigrated.setValue(true)
}
