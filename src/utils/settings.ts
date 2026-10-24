/**
 * 扩展设置（基于 WXT storage，跨页面共享、持久化）。
 */

import type { TranslateTargetSetting } from '@/features/translate/languages'
import { DEFAULT_LLM_CONFIG, type LlmConfig } from '@/features/translate/llm-config'
import { normalizeBypassList } from '@/utils/network'

/** 翻译引擎：微软 / Google 免费接口，或用户自配的 AI 大模型（OpenAI 兼容） */
export type TranslateProvider = 'microsoft' | 'google' | 'llm'

export function isTranslateProvider(value: unknown): value is TranslateProvider {
  return value === 'microsoft' || value === 'google' || value === 'llm'
}

/** 查词引擎（popup 顶部查词框用，含有道） */
export type LookupProvider = 'youdao' | 'microsoft' | 'google'

/** 网页翻译引擎：默认微软（国内可直连、免费、无需翻墙） */
export const translateProvider = storage.defineItem<TranslateProvider>('local:translateProvider', {
  fallback: 'microsoft',
})

/* -------------------------------- 网页翻译 -------------------------------- */

/** 译文展示方式：双语对照 / 仅显示译文（隐藏原文） */
export type TranslateDisplayMode = 'bilingual' | 'translation'

export function isTranslateDisplayMode(value: unknown): value is TranslateDisplayMode {
  return value === 'bilingual' || value === 'translation'
}

/** 悬停翻译触发方式：关闭 / 鼠标停留 / 按住修饰键 */
export type HoverTranslateMode = 'off' | 'dwell' | 'alt' | 'ctrl' | 'shift'

export function isHoverTranslateMode(value: unknown): value is HoverTranslateMode {
  return ['off', 'dwell', 'alt', 'ctrl', 'shift'].includes(value as string)
}

/** 目标语言：默认自动（中文页面译英文，其余译简体中文） */
export const translateTargetLang = storage.defineItem<TranslateTargetSetting>(
  'local:translateTargetLang',
  { fallback: 'auto' },
)

/** 译文展示方式：默认双语对照 */
export const translateDisplayMode = storage.defineItem<TranslateDisplayMode>(
  'local:translateDisplayMode',
  { fallback: 'bilingual' },
)

/** 译文下方显示虚线，方便区分原文 / 译文（默认关闭） */
export const translateUnderline = storage.defineItem<boolean>('local:translateUnderline', {
  fallback: false,
})

/** 打开即自动整页翻译的网站（hostname 列表） */
export const translateAutoHosts = storage.defineItem<string[]>('local:translateAutoHosts', {
  fallback: [],
})

/** 悬停翻译：默认按住 Alt(⌥) 时翻译鼠标下的段落 */
export const hoverTranslateMode = storage.defineItem<HoverTranslateMode>(
  'local:hoverTranslateMode',
  { fallback: 'alt' },
)

/** AI 翻译配置（接口地址 / 模型 / 自定义提示词；参与备份） */
export const translateLlmConfig = storage.defineItem<LlmConfig>('local:translateLlmConfig', {
  fallback: DEFAULT_LLM_CONFIG,
})

/** AI 翻译 API Key：仅存本机，不参与备份导出，避免明文泄露 */
export const translateLlmApiKey = storage.defineItem<string>('local:translateLlmApiKey', {
  fallback: '',
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

/** 解除复制 / 选择 / 右键限制的网站（hostname 列表，按站点开启，默认为空） */
export const unlockHosts = storage.defineItem<string[]>('local:unlockHosts', {
  fallback: [],
})

/** 开发调试：为网页 XHR/fetch 响应补充 CORS 头（默认关闭） */
export const enableCorsBypass = storage.defineItem<boolean>('local:enableCorsBypass', {
  fallback: false,
})

/* -------------------------------- 网络面板 -------------------------------- */

/** 网络模式：直连 / 系统代理 / 自动模式 / 代理模式 */
export type NetworkMode = 'direct' | 'system' | 'global' | 'scenario'
export type NetworkProxyProfileMode = Extract<NetworkMode, 'global' | 'scenario'>

/** 代理协议 */
export type NetworkProxyScheme = 'http' | 'https' | 'socks4' | 'socks5'

/** 代理服务器配置 */
export interface NetworkProxyProfile {
  scheme: NetworkProxyScheme
  host: string
  port: number
  bypassList: string[]
}

/** 自动模式规则列表格式 */
export type NetworkRuleListFormat = 'AutoProxy'

/** 自动模式规则列表配置 */
export interface NetworkRuleListConfig {
  enabled: boolean
  format: NetworkRuleListFormat
  url: string
  text: string
  lastUpdate: string
  proxyRuleCount: number
  directRuleCount: number
}

/** 自定义代理模式：命名保存一套代理配置 */
export interface NetworkCustomProxyModeProfile {
  id: string
  name: string
  proxyProfile: NetworkProxyProfile
  updatedAt: string
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

/** 旧版手填绕过列表（仅作为迁移来源保留，旧版本存于 sync） */
export const networkProxyBypassList = storage.defineItem<string[]>('sync:networkProxyBypassList', {
  fallback: DEFAULT_NETWORK_PROXY_PROFILE.bypassList,
})

/** 代理模式配置 */
export const networkGlobalProxyProfile = storage.defineItem<NetworkProxyProfile>(
  'local:networkGlobalProxyProfile',
  { fallback: DEFAULT_NETWORK_PROXY_PROFILE },
)

/** 自动模式配置 */
export const networkScenarioProxyProfile = storage.defineItem<NetworkProxyProfile>(
  'local:networkScenarioProxyProfile',
  { fallback: DEFAULT_NETWORK_PROXY_PROFILE },
)

/** 自动模式规则列表：启用后命中规则走代理，未命中直连 */
export const networkRuleList = storage.defineItem<NetworkRuleListConfig>('local:networkRuleList', {
  fallback: DEFAULT_NETWORK_RULE_LIST,
})

/** 自定义代理模式列表（本机代理配置，不跨设备同步） */
export const networkCustomProxyModeProfiles = storage.defineItem<NetworkCustomProxyModeProfile[]>(
  'local:networkCustomProxyModeProfiles',
  { fallback: [] },
)

/** 当前选中的自定义代理模式 id */
export const networkActiveCustomProxyModeId = storage.defineItem<string>(
  'local:networkActiveCustomProxyModeId',
  { fallback: '' },
)

/** 切换网络模式后自动刷新当前页面（默认关闭） */
export const enableReloadOnProxySwitch = storage.defineItem<boolean>(
  'local:enableReloadOnProxySwitch',
  { fallback: false },
)

/* ------------------------------- 新标签页 ------------------------------- */

/** 主题模式：自动（按本地时间） / 浅色 / 深色 */
export type ThemeMode = 'auto' | 'light' | 'dark'
export type StoredThemeMode = ThemeMode | 'system'

/** 新标签页动态背景模式：随机 / 固定 */
export type NewtabShaderMode = 'random' | 'fixed'

export function isNewtabShaderMode(value: unknown): value is NewtabShaderMode {
  return value === 'random' || value === 'fixed'
}

/** 新标签页动态背景效果 */
export const NEWTAB_SHADER_EFFECTS = [
  'mesh',
  'neuro',
  'simplex',
  'smoke',
  'metaballs',
  'voronoi',
  'warp',
  'heatmap',
  'grain',
  'panels',
  'water',
  'gem',
] as const
export type NewtabShaderEffect = (typeof NEWTAB_SHADER_EFFECTS)[number]

export function isNewtabShaderEffect(value: unknown): value is NewtabShaderEffect {
  return typeof value === 'string' && (NEWTAB_SHADER_EFFECTS as readonly string[]).includes(value)
}

/** 快捷导航分类 id（展示常量见 features/newtab/categories.ts） */
export type QuickNavCategoryId = 'common' | 'dev' | 'ai' | 'community' | 'tools'

/** 分类自定义名称覆盖（仅存与默认名不同的项，缺省用默认名） */
export type QuickNavCategoryLabels = Partial<Record<QuickNavCategoryId, string>>

/** 分类自定义名称（经同步镜像跨设备同步） */
export const quickNavCategoryLabels = storage.defineItem<QuickNavCategoryLabels>(
  'local:quickNavCategoryLabels',
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
export const searchEngine = storage.defineItem<string>('local:searchEngine', {
  fallback: 'google',
})

/** 快捷导航卡片列表（为空时由 newtab 落库默认开发者站点；经同步镜像跨设备同步） */
export const quickNavItems = storage.defineItem<QuickNavItem[]>('local:quickNavItems', {
  fallback: [],
})

/** newtab 上次选中的导航分类（本机记忆，无需跨设备） */
export const newtabActiveCategory = storage.defineItem<string>('local:newtabActiveCategory', {
  fallback: 'common',
})

/** 分类默认站点一次性种子标记（本机） */
export const quickNavCategorySeeded = storage.defineItem<boolean>('local:quickNavCategorySeeded', {
  fallback: false,
})

/** 默认固定栏一次性种子标记：仅在用户还没有固定项时应用默认固定 */
export const quickNavDefaultPinsSeeded = storage.defineItem<boolean>(
  'local:quickNavDefaultPinsSeeded',
  { fallback: false },
)

/** 浏览器内建页入口一次性种子标记：补齐历史 / 下载 / 扩展管理 */
export const quickNavBuiltinPagesSeeded = storage.defineItem<boolean>(
  'local:quickNavBuiltinPagesSeeded',
  { fallback: false },
)

/** 主题模式：默认自动（18:00-06:00 深色，其余浅色） */
export const themeMode = storage.defineItem<StoredThemeMode>('local:themeMode', {
  fallback: 'auto',
})

/** 新标签页动态背景效果 */
export const newtabShaderEffect = storage.defineItem<NewtabShaderEffect>(
  'local:newtabShaderEffect',
  { fallback: 'mesh' },
)

/** 新标签页动态背景模式 */
export const newtabShaderMode = storage.defineItem<NewtabShaderMode>('local:newtabShaderMode', {
  fallback: 'random',
})

/** 随机背景首次展示标记：默认随机，但首次固定展示流体 */
export const newtabShaderRandomSeeded = storage.defineItem<boolean>(
  'local:newtabShaderRandomSeeded',
  { fallback: false },
)

/** popup 快捷键可打开的 Tab */
export const POPUP_SHORTCUT_TABS = ['translate', 'network', 'tools', 'function'] as const
export type PopupShortcutTab = (typeof POPUP_SHORTCUT_TABS)[number]

export function isPopupShortcutTab(value: unknown): value is PopupShortcutTab {
  return typeof value === 'string' && (POPUP_SHORTCUT_TABS as readonly string[]).includes(value)
}

/**
 * popup 下次打开时要定位的 Tab（一次性信号）。
 * Alt+1..4 等命令经后台写入对应 Tab，popup 读取后立即清空。
 */
export const popupInitialTab = storage.defineItem<PopupShortcutTab | ''>('local:popupInitialTab', {
  fallback: '',
})

/** popup 面板上次选中的功能页（本机持久化，用于下次从工具栏重新打开时恢复）。 */
export const popupLastActiveTab = storage.defineItem<PopupShortcutTab>('local:popupLastActiveTab', {
  fallback: 'translate',
})

/** 点击工具栏图标或 Alt+1 打开 popup 时默认定位的 Tab（在「功能」页可配置，默认翻译）。 */
export const defaultPopupTab = storage.defineItem<string>('local:defaultPopupTab', {
  fallback: 'translate',
})

/* -------------------------------- 跨设备同步 -------------------------------- */

/** 同步镜像的运行状态（后台写入，「功能」页展示） */
export interface SyncStatus {
  state: 'idle' | 'syncing' | 'ok' | 'error'
  /** 失败原因（中文，可直接展示） */
  message?: string
  /** 最近一次成功完成同步（上传或下载）的时间 */
  lastSyncedAt?: number
  /** chrome.storage.sync 已用字节数 */
  bytesInUse?: number
}

export const syncStatus = storage.defineItem<SyncStatus>('local:syncStatus', {
  fallback: { state: 'idle' },
})

/* -------------------------------- 存储迁移 -------------------------------- */

/**
 * 存储布局版本：
 * - v1（旧版）：新标签页 / 待办 / 部分偏好直接存在 sync 的单个 key 里，列表变长后超过单项 8KB 上限导致同步失败；
 * - v2：所有数据以 local 为准，需要跨设备的数据由后台分片镜像到 sync（见 utils/sync-mirror.ts）。
 */
const storageLayoutVersion = storage.defineItem<number>('local:storageLayoutVersion', {
  fallback: 0,
})

/** v1 时代存在 sync 里的 key（v2 起改为 local 同名 key） */
const LEGACY_SYNC_KEYS = [
  'quickNavCategoryLabels',
  'searchEngine',
  'quickNavItems',
  'quickNavCategorySeeded',
  'quickNavDefaultPinsSeeded',
  'quickNavBuiltinPagesSeeded',
  'themeMode',
  'newtabShaderEffect',
  'newtabShaderMode',
  'newtabShaderRandomSeeded',
  'defaultPopupTab',
] as const
const networkProxyProfilesMigrated = storage.defineItem<boolean>(
  'local:networkProxyProfilesMigratedByMode',
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

function normalizeStoredNetworkProxyProfile(profile: NetworkProxyProfile): NetworkProxyProfile {
  return {
    ...profile,
    host: profile.host.trim(),
    port: Number.isFinite(profile.port) ? Math.trunc(profile.port) : 0,
    bypassList: normalizeNetworkProxyBypassList(profile.bypassList),
  }
}

function isDefaultNetworkProxyProfile(profile: NetworkProxyProfile): boolean {
  const normalized = normalizeStoredNetworkProxyProfile(profile)
  const defaultProfile = normalizeStoredNetworkProxyProfile(DEFAULT_NETWORK_PROXY_PROFILE)
  return (
    normalized.scheme === defaultProfile.scheme &&
    normalized.host === defaultProfile.host &&
    normalized.port === defaultProfile.port &&
    normalized.bypassList.length === defaultProfile.bypassList.length &&
    normalized.bypassList.every((item, index) => item === defaultProfile.bypassList[index])
  )
}

async function migrateNetworkProxyProfilesByMode(): Promise<void> {
  if (await networkProxyProfilesMigrated.getValue()) return

  const [localProfile, oldSyncProfile, syncBypassList, globalProfile, scenarioProfile] =
    await Promise.all([
      storage.getItem<NetworkProxyProfile>('local:networkProxyProfile'),
      storage.getItem<NetworkProxyProfile>('sync:networkProxyProfile'),
      networkProxyBypassList.getValue(),
      networkGlobalProxyProfile.getValue(),
      networkScenarioProxyProfile.getValue(),
    ])
  const localBypassList = getBypassListFromProfile(localProfile)
  const oldSyncBypassList = getBypassListFromProfile(oldSyncProfile)
  const nextBypassList =
    localBypassList || oldSyncBypassList || normalizeNetworkProxyBypassList(syncBypassList)
  const sourceProfile = isNetworkProxyProfile(localProfile)
    ? localProfile
    : isNetworkProxyProfile(oldSyncProfile)
      ? oldSyncProfile
      : null

  if (sourceProfile) {
    const nextProfile = normalizeStoredNetworkProxyProfile({
      ...sourceProfile,
      bypassList: nextBypassList || sourceProfile.bypassList,
    })
    const tasks: Promise<void>[] = []
    if (isDefaultNetworkProxyProfile(globalProfile)) {
      tasks.push(networkGlobalProxyProfile.setValue(nextProfile))
    }
    if (isDefaultNetworkProxyProfile(scenarioProfile)) {
      tasks.push(networkScenarioProxyProfile.setValue(nextProfile))
    }
    await Promise.all(tasks)
  } else if (nextBypassList && !isDefaultNetworkProxyBypassList(nextBypassList)) {
    const nextProfile = normalizeStoredNetworkProxyProfile({
      ...DEFAULT_NETWORK_PROXY_PROFILE,
      bypassList: nextBypassList,
    })
    const tasks: Promise<void>[] = []
    if (isDefaultNetworkProxyProfile(globalProfile)) {
      tasks.push(networkGlobalProxyProfile.setValue(nextProfile))
    }
    if (isDefaultNetworkProxyProfile(scenarioProfile)) {
      tasks.push(networkScenarioProxyProfile.setValue(nextProfile))
    }
    await Promise.all(tasks)
  }

  await networkProxyProfilesMigrated.setValue(true)
}

function getNetworkProxyProfileStorage(mode: NetworkProxyProfileMode) {
  return mode === 'scenario' ? networkScenarioProxyProfile : networkGlobalProxyProfile
}

export async function getNetworkProxyProfile(
  mode: NetworkProxyProfileMode = 'global',
): Promise<NetworkProxyProfile> {
  return normalizeStoredNetworkProxyProfile(await getNetworkProxyProfileStorage(mode).getValue())
}

export async function getNetworkProxyProfileForMode(
  mode: NetworkMode,
): Promise<NetworkProxyProfile> {
  if (mode === 'scenario') return getNetworkProxyProfile('scenario')

  if (mode === 'global') {
    const [profiles, activeId] = await Promise.all([
      networkCustomProxyModeProfiles.getValue(),
      networkActiveCustomProxyModeId.getValue(),
    ])
    const customProfile = profiles.find((item) => item.id === activeId)?.proxyProfile
    if (customProfile) return normalizeStoredNetworkProxyProfile(customProfile)
    return getNetworkProxyProfile('global')
  }

  return normalizeStoredNetworkProxyProfile(DEFAULT_NETWORK_PROXY_PROFILE)
}

export async function setNetworkProxyProfile(
  profile: NetworkProxyProfile,
  mode: NetworkProxyProfileMode = 'global',
): Promise<void> {
  await getNetworkProxyProfileStorage(mode).setValue(normalizeStoredNetworkProxyProfile(profile))
}

/**
 * v1 → v2：把旧版存在 sync 里的数据搬回 local（sync 中的值是旧版的权威数据，覆盖 local 同名旧值）。
 * 旧 sync key 保留不删：还没升级的其他设备仍在读写它们，删除会让那些设备看到空数据。
 */
async function migrateLegacySyncToLocal(): Promise<void> {
  if ((await storageLayoutVersion.getValue()) >= 2) return

  const legacy = await browser.storage.sync.get([...LEGACY_SYNC_KEYS])
  const values = Object.fromEntries(
    Object.entries(legacy).filter(([, value]) => value !== undefined && value !== null),
  )
  if (Object.keys(values).length) await browser.storage.local.set(values)
  await storageLayoutVersion.setValue(2)
}

/**
 * 存储迁移入口（幂等）：各页面渲染前与后台启动时 await。
 * 迁移失败不会抛到调用方之外的逻辑里，最坏情况是继续使用 local 现有数据。
 */
export async function migrateStorage(): Promise<void> {
  await migrateNetworkProxyProfilesByMode()
  await migrateLegacySyncToLocal()
}
