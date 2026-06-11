/**
 * 配置备份：把所有持久化设置（含待办、快捷导航、网络配置等）导出为 JSON / 从 JSON 导入。
 */

import {
  defaultPopupTab,
  enableCorsBypass,
  enableGithubEnhance,
  enableReloadOnProxySwitch,
  enableSelectionTranslate,
  lookupProvider,
  networkMode,
  networkProxyProfile,
  networkRuleList,
  quickNavCategoryLabels,
  quickNavCategorySeeded,
  quickNavItems,
  searchEngine,
  themeMode,
  todoItems,
  translateProvider,
} from '@/utils/settings'

/** 备份文件结构 */
export interface BackupFile {
  app: 'DevGo'
  version: string
  exportedAt: string
  data: Record<string, unknown>
}

interface BackupItem {
  getValue(): Promise<unknown>
  setValue(value: never): Promise<void>
  fallback: unknown
}

/**
 * 参与备份的全部存储项（key 即备份文件里的字段名，保持稳定，勿随意改名）。
 * 不含 popupInitialTab（一次性信号）和 networkProxyManaged（本机代理接管标记，
 * 导入后是否接管浏览器代理应由用户在网络面板重新确认）。
 */
const BACKUP_ITEMS: Record<string, BackupItem> = {
  translateProvider,
  lookupProvider,
  enableSelectionTranslate,
  enableGithubEnhance,
  enableCorsBypass,
  networkMode,
  networkProxyProfile,
  networkRuleList,
  enableReloadOnProxySwitch,
  searchEngine,
  quickNavItems,
  quickNavCategoryLabels,
  themeMode,
  todoItems,
  defaultPopupTab,
}

/** 值与该项默认值的「形状」一致才允许导入（数组对数组、对象对对象、原始类型同 typeof） */
function matchesShape(value: unknown, fallback: unknown): boolean {
  if (Array.isArray(fallback)) return Array.isArray(value)
  if (fallback !== null && typeof fallback === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }
  return typeof value === typeof fallback
}

/** 读取全部配置，生成备份对象 */
export async function buildBackup(): Promise<BackupFile> {
  const keys = Object.keys(BACKUP_ITEMS)
  const values = await Promise.all(keys.map((key) => BACKUP_ITEMS[key].getValue()))
  const data: Record<string, unknown> = {}
  keys.forEach((key, i) => {
    data[key] = values[i]
  })
  return {
    app: 'DevGo',
    version: browser.runtime.getManifest().version,
    exportedAt: new Date().toISOString(),
    data,
  }
}

/**
 * 从备份 JSON 文本恢复配置。
 * 仅写入已知字段，且逐项校验类型；网络相关项写入后由后台 watch 自动重新应用。
 * @returns imported 成功导入的项数；skipped 因类型不符被跳过的字段
 */
export async function restoreBackup(
  text: string,
): Promise<{ imported: number; skipped: string[] }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }

  const data = (parsed as Partial<BackupFile>)?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('不是 DevGo 的备份文件')
  }

  const skipped: string[] = []
  const tasks: Promise<void>[] = []
  Object.entries(BACKUP_ITEMS).forEach(([key, item]) => {
    if (!(key in data)) return
    const value = data[key]
    if (!matchesShape(value, item.fallback)) {
      skipped.push(key)
      return
    }
    tasks.push(item.setValue(value as never))
  })
  await Promise.all(tasks)
  // 旧版备份的导航项可能没有 category（恢复后全部落在「常用」），
  // 重置种子标记让 newtab 下次打开时给空分类补默认站点。
  if ('quickNavItems' in data) await quickNavCategorySeeded.setValue(false)
  return { imported: tasks.length, skipped }
}
