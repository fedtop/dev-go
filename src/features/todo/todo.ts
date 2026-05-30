/**
 * TODO 共享逻辑：任务状态定义、数据清洗 / 迁移、导入 / 导出。
 *
 * newtab（看板）与 popup（待办页）共用本模块，保证行为一致。
 */

import type { TodoItem, TodoStatus } from '@/utils/settings'

const FORMAT = 'devgo-todo'
const VERSION = 1

export const TODO_STATUSES: TodoStatus[] = ['todo', 'doing', 'done']
export const TODO_STATUS_LABEL: Record<TodoStatus, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
}

interface TodoFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  todoItems: TodoItem[]
}

/** 把任意状态值规整成合法的 TodoStatus（兼容老数据里的 done:boolean） */
function coerceStatus(raw: Record<string, unknown>): TodoStatus {
  const { status, done } = raw
  if (status === 'todo' || status === 'doing' || status === 'done') return status
  // 旧版本只有布尔 done 字段：true -> 已完成，否则 -> 待办
  if (done === true) return 'done'
  return 'todo'
}

/** 把任意输入清洗成合法的任务数组（丢弃非法项，迁移旧字段） */
export function sanitizeTodos(input: unknown): TodoItem[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === 'object')
    .map((raw) => {
      const { id, text, createdAt } = raw
      if (typeof text !== 'string' || !text.trim()) return null
      return {
        id: typeof id === 'string' && id ? id : crypto.randomUUID(),
        text: text.trim(),
        status: coerceStatus(raw),
        createdAt: typeof createdAt === 'number' ? createdAt : 0,
      }
    })
    .filter((item): item is TodoItem => item !== null)
}

/** 序列化为可下载的 JSON 字符串 */
export function serializeTodos(items: TodoItem[], now: string): string {
  const file: TodoFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: now,
    todoItems: items,
  }
  return JSON.stringify(file, null, 2)
}

/** 触发浏览器下载导出文件 */
export function downloadTodos(items: TodoItem[], now: string): void {
  const blob = new Blob([serializeTodos(items, now)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `devgo-todo-${now.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 解析并校验导入的 JSON 文本，非法时抛错 */
export function parseTodos(text: string): TodoItem[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('文件不是合法的 JSON')
  }
  if (!data || typeof data !== 'object') throw new Error('配置格式不正确')

  const obj = data as Record<string, unknown>
  if (obj.format !== FORMAT) throw new Error('不是 DevGo TODO 配置文件')

  const items = sanitizeTodos(obj.todoItems)
  if (items.length === 0) throw new Error('文件中没有可导入的任务')
  return items
}

/**
 * 把导入的任务合并进现有列表：按 id 去重，已存在的跳过，新项追加。
 * 返回合并后的列表与新增数量，便于给用户反馈。
 */
export function mergeTodos(
  current: TodoItem[],
  incoming: TodoItem[],
): { items: TodoItem[]; added: number } {
  const seen = new Set(current.map((i) => i.id))
  const fresh = incoming.filter((i) => !seen.has(i.id))
  return { items: [...current, ...fresh], added: fresh.length }
}

export type DropPosition = 'before' | 'after'

/**
 * 把 sourceId 移动到 targetId 的前 / 后，并使其状态与 target 一致。
 * 用于拖拽排序（同列内调序）与跨列拖拽（落到目标卡片旁、顺带改状态）。
 * targetId 为 null 时表示拖到某状态列的空白处：仅改状态并移到该状态末尾。
 */
export function moveTodo(
  items: TodoItem[],
  sourceId: string,
  targetId: string | null,
  status: TodoStatus,
  position: DropPosition = 'before',
): TodoItem[] {
  const sourceIndex = items.findIndex((i) => i.id === sourceId)
  if (sourceIndex < 0) return items

  const next = [...items]
  const [moved] = next.splice(sourceIndex, 1)
  const source = { ...moved, status }

  if (!targetId || targetId === sourceId) {
    // 落到空白处：追加到同状态项之后（保持其它项顺序）。
    const lastSame = next.reduce((acc, item, idx) => (item.status === status ? idx : acc), -1)
    next.splice(lastSame + 1, 0, source)
    return next
  }

  const targetIndex = next.findIndex((i) => i.id === targetId)
  if (targetIndex < 0) {
    next.splice(sourceIndex, 0, source)
    return next
  }
  const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex
  next.splice(insertIndex, 0, source)
  return next
}
