/**
 * 扩展设置（基于 WXT storage，跨页面共享、持久化）。
 */

import { normalizeBypassList } from '@/utils/network'

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

/** 网络模式：直连 / 系统代理 / 代理模式 / 情境模式 */
export type NetworkMode = 'direct' | 'system' | 'global' | 'scenario'

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

/** 网络功能总开关：控制代理与 CORS 调试辅助是否运行时生效（配置偏好仍保留） */
export const networkFeaturesEnabled = storage.defineItem<boolean>('local:networkFeaturesEnabled', {
  fallback: false,
})

/** 是否由 DevGo 接管浏览器代理配置（用户首次在网络面板应用后开启） */
export const networkProxyManaged = storage.defineItem<boolean>('local:networkProxyManaged', {
  fallback: false,
})

/** 当前网络模式 */
export const networkMode = storage.defineItem<NetworkMode>('local:networkMode', {
  fallback: 'system',
})

/** 代理服务器配置（本机保存，避免不同设备的代理端口互相覆盖） */
export const networkProxyProfile = storage.defineItem<NetworkProxyProfile>(
  'local:networkProxyProfile',
  {
    fallback: DEFAULT_NETWORK_PROXY_PROFILE,
  },
)

/** 手填绕过列表（跨设备同步） */
export const networkProxyBypassList = storage.defineItem<string[]>('sync:networkProxyBypassList', {
  fallback: DEFAULT_NETWORK_PROXY_PROFILE.bypassList,
})

/** 情境模式规则列表：启用后命中规则走代理，未命中直连 */
export const networkRuleList = storage.defineItem<NetworkRuleListConfig>('local:networkRuleList', {
  fallback: DEFAULT_NETWORK_RULE_LIST,
})

/** 切换网络模式后自动刷新当前页面（默认关闭） */
export const enableReloadOnProxySwitch = storage.defineItem<boolean>(
  'local:enableReloadOnProxySwitch',
  { fallback: false },
)

/* ------------------------------- 新标签页 ------------------------------- */

/** 主题模式：自动（按本地时间） / 浅色 / 深色 */
export type ThemeMode = 'auto' | 'light' | 'dark'
export type StoredThemeMode = ThemeMode | 'system'

/** 快捷导航分类 id（展示常量见 features/newtab/categories.ts） */
export type QuickNavCategoryId = 'common' | 'dev' | 'ai' | 'community' | 'tools'

/** 分类自定义名称覆盖（仅存与默认名不同的项，缺省用默认名） */
export type QuickNavCategoryLabels = Partial<Record<QuickNavCategoryId, string>>

/** 分类自定义名称（跨设备同步） */
export const quickNavCategoryLabels = storage.defineItem<QuickNavCategoryLabels>(
  'sync:quickNavCategoryLabels',
  { fallback: {} },
)

/** 快捷导航卡片 */
export interface QuickNavItem {
  id: string
  title: string
  url: string
  /** 所属分类；旧数据无此字段，缺省视为「常用」 */
  category?: QuickNavCategoryId
  /** 是否固定到搜索框下方的固定栏 */
  pinned?: boolean
}

/** 新标签页当前搜索引擎 id（见 features/newtab/engines.ts，默认 google） */
export const searchEngine = storage.defineItem<string>('sync:searchEngine', {
  fallback: 'google',
})

/** 快捷导航卡片列表（为空时由 newtab 落库默认开发者站点） */
export const quickNavItems = storage.defineItem<QuickNavItem[]>('sync:quickNavItems', {
  fallback: [],
})

/** newtab 上次选中的导航分类（本机记忆，无需跨设备） */
export const newtabActiveCategory = storage.defineItem<string>('local:newtabActiveCategory', {
  fallback: 'common',
})

/** 分类默认站点一次性种子标记（仿 sync:migratedFromLocal 模式，不参与备份） */
export const quickNavCategorySeeded = storage.defineItem<boolean>('sync:quickNavCategorySeeded', {
  fallback: false,
})

/** 默认固定栏一次性种子标记：仅在用户还没有固定项时应用默认固定 */
export const quickNavDefaultPinsSeeded = storage.defineItem<boolean>(
  'sync:quickNavDefaultPinsSeeded',
  { fallback: false },
)

/** 浏览器内建页入口一次性种子标记：补齐历史 / 下载 / 扩展管理 */
export const quickNavBuiltinPagesSeeded = storage.defineItem<boolean>(
  'sync:quickNavBuiltinPagesSeeded',
  { fallback: false },
)

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

/** popup 快捷键可打开的 Tab */
export const POPUP_SHORTCUT_TABS = ['translate', 'todo', 'network', 'tools', 'function'] as const
export type PopupShortcutTab = typeof POPUP_SHORTCUT_TABS[number]

export function isPopupShortcutTab(value: unknown): value is PopupShortcutTab {
  return typeof value === 'string' && (POPUP_SHORTCUT_TABS as readonly string[]).includes(value)
}

/** 新标签页 TODO 任务列表（持久化、跨设备同步，抗扩展卸载/重装） */
export const todoItems = storage.defineItem<TodoItem[]>('sync:todoItems', {
  fallback: [],
})

/**
 * popup 下次打开时要定位的 Tab（一次性信号）。
 * Alt+1..4 等命令经后台写入对应 Tab，popup 读取后立即清空。
 */
export const popupInitialTab = storage.defineItem<PopupShortcutTab | ''>('local:popupInitialTab', {
  fallback: '',
})

/**
 * 点击工具栏图标或 Alt+1 打开 popup 时默认定位的 Tab（在「功能」页可配置，默认翻译）。
 * 跨设备同步：换设备后默认 Tab 偏好保持一致。
 */
export const defaultPopupTab = storage.defineItem<string>('sync:defaultPopupTab', {
  fallback: 'translate',
})

/* ------------------------------ local → sync 迁移 ------------------------------ */

/** 迁移完成标记，确保只搬一次（即便用户清空了 sync 数据也不会反复覆盖） */
const syncMigrated = storage.defineItem<boolean>('sync:migratedFromLocal', { fallback: false })
const networkProxyBypassListMigrated = storage.defineItem<boolean>(
  'local:networkProxyBypassListMigratedToSync',
  { fallback: false },
)
const networkFeaturesEnabledMigrated = storage.defineItem<boolean>(
  'local:networkFeaturesEnabledMigrated',
  { fallback: false },
)

function normalizeNetworkProxyBypassList(value: string[]): string[] {
  return normalizeBypassList(value)
}

function isDefaultNetworkProxyBypassList(value: string[]): boolean {
  const normalized = normalizeNetworkProxyBypassList(value)
  return (
    normalized.length === DEFAULT_NETWORK_PROXY_PROFILE.bypassList.length &&
    normalized.every((item, index) => item === DEFAULT_NETWORK_PROXY_PROFILE.bypassList[index])
  )
}

function isNetworkProxyProfile(value: unknown): value is NetworkProxyProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const profile = value as Partial<NetworkProxyProfile>
  return (
    (profile.scheme === 'http' ||
      profile.scheme === 'https' ||
      profile.scheme === 'socks4' ||
      profile.scheme === 'socks5') &&
    typeof profile.host === 'string' &&
    typeof profile.port === 'number' &&
    Array.isArray(profile.bypassList) &&
    profile.bypassList.every((item) => typeof item === 'string')
  )
}

function getBypassListFromProfile(value: unknown): string[] | null {
  return isNetworkProxyProfile(value) ? normalizeNetworkProxyBypassList(value.bypassList) : null
}

async function migrateNetworkProxyBypassListToSync(): Promise<void> {
  if (await networkProxyBypassListMigrated.getValue()) return

  const [localProfile, oldSyncProfile, syncBypassList] = await Promise.all([
    storage.getItem<NetworkProxyProfile>('local:networkProxyProfile'),
    storage.getItem<NetworkProxyProfile>('sync:networkProxyProfile'),
    networkProxyBypassList.getValue(),
  ])
  const localBypassList = getBypassListFromProfile(localProfile)
  const oldSyncBypassList = getBypassListFromProfile(oldSyncProfile)
  const nextBypassList = localBypassList || oldSyncBypassList

  if (
    nextBypassList &&
    !isDefaultNetworkProxyBypassList(nextBypassList) &&
    isDefaultNetworkProxyBypassList(syncBypassList)
  ) {
    await networkProxyBypassList.setValue(nextBypassList)
  }

  await networkProxyBypassListMigrated.setValue(true)
}

export async function getNetworkProxyProfile(): Promise<NetworkProxyProfile> {
  const [profile, bypassList] = await Promise.all([
    networkProxyProfile.getValue(),
    networkProxyBypassList.getValue(),
  ])

  return {
    ...profile,
    bypassList: normalizeNetworkProxyBypassList(bypassList),
  }
}

export async function setNetworkProxyProfile(profile: NetworkProxyProfile): Promise<void> {
  const nextProfile = {
    ...profile,
    bypassList: normalizeNetworkProxyBypassList(profile.bypassList),
  }

  await Promise.all([
    networkProxyProfile.setValue(nextProfile),
    networkProxyBypassList.setValue(nextProfile.bypassList),
  ])
}

/**
 * 把早期存于 local 的新标签页 / 待办 / 网络面板绕过列表搬到 sync，使其可跨设备同步、抗卸载。
 * - 仅当从未迁移过时执行（一次性）。
 * - 逐项仅在「sync 还是默认值 且 local 有有效数据」时搬运，避免覆盖更新的 sync 数据。
 * - 旧 local 数据保留不删，作为本机兜底。
 * 应在各页面渲染前 await（见各 entrypoint 的 main.tsx）。
 */
/** 升级后：若用户此前已启用代理或 CORS，则默认打开网络功能总开关 */
export async function migrateNetworkFeaturesEnabled(): Promise<void> {
  if (await networkFeaturesEnabledMigrated.getValue()) return

  const [managed, corsEnabled] = await Promise.all([
    networkProxyManaged.getValue(),
    enableCorsBypass.getValue(),
  ])

  if (managed || corsEnabled) {
    await networkFeaturesEnabled.setValue(true)
  }

  await networkFeaturesEnabledMigrated.setValue(true)
}

export async function migrateLocalToSync(): Promise<void> {
  await migrateNetworkProxyBypassListToSync()
  await migrateNetworkFeaturesEnabled()

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
