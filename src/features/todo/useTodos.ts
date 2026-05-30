/**
 * useTodos：TODO 数据的共享读写 hook。
 *
 * - 首次挂载从 storage 读取并做一次清洗 / 迁移（兼容旧 done 字段）。
 * - 通过 storage.watch 监听变更，newtab 与 popup 之间实时同步。
 * - 暴露常用操作（增 / 删 / 改状态 / 改文案 / 清除已完成 / 整体替换）。
 */

import { useEffect, useRef, useState } from 'react'

import { todoItems, type TodoItem, type TodoStatus } from '@/utils/settings'
import { moveTodo, sanitizeTodos, type DropPosition } from './todo'

export interface UseTodos {
  items: TodoItem[]
  ready: boolean
  add: (text: string, status?: TodoStatus) => void
  remove: (id: string) => void
  setStatus: (id: string, status: TodoStatus) => void
  setText: (id: string, text: string) => void
  move: (
    sourceId: string,
    targetId: string | null,
    status: TodoStatus,
    position?: DropPosition,
  ) => void
  clearDone: () => void
  replaceAll: (items: TodoItem[]) => void
}

export function useTodos(): UseTodos {
  const [items, setItems] = useState<TodoItem[]>([])
  const [ready, setReady] = useState(false)
  // 标记本页面发起的写入，避免 watch 回灌时多余的 setState。
  const selfWrite = useRef<TodoItem[] | null>(null)

  useEffect(() => {
    let alive = true
    todoItems.getValue().then((stored) => {
      if (!alive) return
      const clean = sanitizeTodos(stored)
      setItems(clean)
      setReady(true)
      // 若清洗后结构变化（迁移过旧数据），回写一次。
      if (JSON.stringify(clean) !== JSON.stringify(stored)) todoItems.setValue(clean)
    })

    const unwatch = todoItems.watch((next) => {
      const clean = sanitizeTodos(next)
      if (selfWrite.current && JSON.stringify(selfWrite.current) === JSON.stringify(clean)) {
        selfWrite.current = null
        return
      }
      setItems(clean)
    })

    return () => {
      alive = false
      unwatch()
    }
  }, [])

  const commit = (next: TodoItem[]) => {
    selfWrite.current = next
    setItems(next)
    todoItems.setValue(next)
  }

  return {
    items,
    ready,
    add: (text, status = 'todo') => {
      const value = text.trim()
      if (!value) return
      commit([{ id: crypto.randomUUID(), text: value, status, createdAt: Date.now() }, ...items])
    },
    remove: (id) => commit(items.filter((i) => i.id !== id)),
    setStatus: (id, status) => commit(items.map((i) => (i.id === id ? { ...i, status } : i))),
    setText: (id, text) => {
      const value = text.trim()
      if (!value) return
      commit(items.map((i) => (i.id === id ? { ...i, text: value } : i)))
    },
    move: (sourceId, targetId, status, position = 'before') =>
      commit(moveTodo(items, sourceId, targetId, status, position)),
    clearDone: () => commit(items.filter((i) => i.status !== 'done')),
    replaceAll: (next) => commit(next),
  }
}
