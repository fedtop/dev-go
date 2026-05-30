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

/** 任务状态：待办 / 进行中 / 已完成 */
export type TodoStatus = 'todo' | 'doing' | 'done'

/** TODO 任务项 */
export interface TodoItem {
  id: string
  text: string
  status: TodoStatus
  createdAt: number
}

/** 新标签页 TODO 任务列表（持久化、跨页面共享） */
export const todoItems = storage.defineItem<TodoItem[]>('local:todoItems', {
  fallback: [],
})

/**
 * popup 下次打开时要定位的 Tab（一次性信号）。
 * Alt+3 经后台写入 'todo'，popup 读取后立即清空。
 */
export const popupInitialTab = storage.defineItem<string>('local:popupInitialTab', {
  fallback: '',
})
