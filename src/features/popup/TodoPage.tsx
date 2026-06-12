/**
 * popup 待办页：420px 紧凑单列。
 * 点状态圆点循环切换 待办→进行中→已完成；支持筛选、增删、导入导出。
 * 与 newtab 看板共用 useTodos，数据实时同步。
 */

import { useMemo, useRef, useState } from 'react'

import { SITE_URL } from '@/utils/constants'
import { isImeComposing } from '@/utils/ime'
import type { TodoStatus } from '@/utils/settings'
import {
  downloadTodos,
  mergeTodos,
  parseTodos,
  TODO_STATUS_LABEL,
  type DropPosition,
} from '@/features/todo/todo'
import { useTodos } from '@/features/todo/useTodos'

type Filter = 'all' | TodoStatus
const FILTERS: Filter[] = ['all', 'todo', 'doing', 'done']
const FILTER_LABEL: Record<Filter, string> = { all: '全部', ...TODO_STATUS_LABEL }

// 圆点点击时的状态流转顺序
const NEXT_STATUS: Record<TodoStatus, TodoStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
}

const DOT_STYLE: Record<TodoStatus, string> = {
  todo: 'border-slate-300 text-transparent hover:border-blue-400',
  doing: 'border-blue-500 bg-blue-500 text-white',
  done: 'border-emerald-500 bg-emerald-500 text-white',
}

function DotIcon({ status }: { status: TodoStatus }) {
  if (status === 'doing') {
    return <span className='h-1.5 w-1.5 rounded-full bg-white' />
  }
  if (status === 'done') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3 w-3 fill-none stroke-current'>
        <path
          d='M5 12.5 10 17.5 19.5 7'
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='2.6'
        />
      </svg>
    )
  }
  return null
}

function EditIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-none stroke-current'>
      <path
        d='M4 20h4L18.5 9.5a2 2 0 0 0-2.83-2.83L5 17.2V20zM14 7l3 3'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.7'
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-none stroke-current'>
      <path
        d='M5 12.5 10 17.5 19.5 7'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2.4'
      />
    </svg>
  )
}

function CancelIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-none stroke-current'>
      <path d='M6 6l12 12M18 6 6 18' strokeLinecap='round' strokeWidth='2.2' />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-none stroke-current'>
      <path
        d='M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.7'
      />
    </svg>
  )
}

export default function TodoPage() {
  const todos = useTodos()
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const fileRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropMarker, setDropMarker] = useState<{ id: string; position: DropPosition } | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const inputComposingRef = useRef(false)
  const editingComposingRef = useRef(false)

  const startEditing = (id: string, text: string) => {
    editingComposingRef.current = false
    setEditing({ id, text })
  }

  const stopEditing = () => {
    editingComposingRef.current = false
    setEditing(null)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const resetDrag = () => {
    setDragId(null)
    setDropMarker(null)
  }

  const add = () => {
    if (!input.trim()) return
    todos.add(input)
    setInput('')
  }

  const handleExport = () => {
    if (todos.items.length === 0) {
      showToast('暂无任务可导出')
      return
    }
    downloadTodos(todos.items, new Date().toISOString())
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const incoming = parseTodos(await file.text())
      const { items: merged, added } = mergeTodos(todos.items, incoming)
      todos.replaceAll(merged)
      showToast(added > 0 ? `已导入 ${added} 个任务` : '没有新任务（已跳过）')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败')
    }
  }

  const visible = useMemo(() => {
    if (filter === 'all') return todos.items
    return todos.items.filter((i) => i.status === filter)
  }, [todos.items, filter])

  const remaining = todos.items.filter((i) => i.status !== 'done').length

  return (
    <div className='flex flex-col'>
      {/* 输入区 */}
      <div className='flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-colors focus-within:border-blue-400 focus-within:bg-white'>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onCompositionStart={() => {
            inputComposingRef.current = true
          }}
          onCompositionEnd={() => {
            inputComposingRef.current = false
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isImeComposing(e, inputComposingRef.current)) add()
          }}
          placeholder='添加任务，回车保存…'
          className='min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400'
        />
        <button
          type='button'
          onClick={add}
          disabled={!input.trim()}
          className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-lg leading-none text-white transition-colors hover:bg-blue-500 disabled:opacity-40'
          title='添加'
        >
          +
        </button>
      </div>

      {/* 筛选 + 计数 */}
      <div className='mt-3 flex items-center justify-between'>
        <div className='flex items-center gap-1'>
          {FILTERS.map((f) => (
            <button
              key={f}
              type='button'
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
        <span className='text-[11px] text-slate-400'>{remaining} 项未完成</span>
      </div>

      {/* 列表 */}
      <div className='mt-2 max-h-[300px] overflow-y-auto'>
        {visible.length === 0 ? (
          <div className='flex flex-col items-center justify-center gap-1.5 py-10 text-center'>
            <span className='text-2xl opacity-80'>🗒️</span>
            <span className='text-xs text-slate-400'>
              {todos.items.length === 0 ? '还没有任务，添加第一个吧' : '该分类下暂无任务'}
            </span>
          </div>
        ) : (
          <ul className='flex flex-col gap-1'>
            {visible.map((item) => {
              const isEditing = editing?.id === item.id
              const marker = dropMarker?.id === item.id ? dropMarker.position : null
              return (
                <li
                  key={item.id}
                  draggable={!isEditing}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    setDragId(item.id)
                  }}
                  onDragOver={(e) => {
                    if (!dragId || dragId === item.id) return
                    e.preventDefault()
                    const rect = e.currentTarget.getBoundingClientRect()
                    const position: DropPosition =
                      e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                    setDropMarker({ id: item.id, position })
                  }}
                  onDrop={(e) => {
                    if (!dragId) return
                    e.preventDefault()
                    // popup 单列只做排序，保留被拖项自身状态（改状态请点左侧圆点）
                    const dragged = todos.items.find((i) => i.id === dragId)
                    if (dragged) {
                      todos.move(dragId, item.id, dragged.status, dropMarker?.position ?? 'before')
                    }
                    resetDrag()
                  }}
                  onDragEnd={resetDrag}
                  className={`group relative flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 ${
                    isEditing ? '' : 'cursor-grab active:cursor-grabbing'
                  } ${dragId === item.id ? 'opacity-40' : ''} ${
                    marker === 'before'
                      ? 'before:absolute before:-top-0.5 before:left-1 before:right-1 before:h-0.5 before:rounded-full before:bg-blue-500'
                      : ''
                  } ${
                    marker === 'after'
                      ? 'after:absolute after:-bottom-0.5 after:left-1 after:right-1 after:h-0.5 after:rounded-full after:bg-blue-500'
                      : ''
                  }`}
                >
                  <button
                    type='button'
                    onClick={() => todos.setStatus(item.id, NEXT_STATUS[item.status])}
                    title={`当前：${TODO_STATUS_LABEL[item.status]}（点击切换）`}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      DOT_STYLE[item.status]
                    }`}
                  >
                    <DotIcon status={item.status} />
                  </button>
                  {isEditing ? (
                    <>
                      <input
                        autoFocus
                        value={editing.text}
                        onChange={(e) => setEditing({ id: item.id, text: e.target.value })}
                        onCompositionStart={() => {
                          editingComposingRef.current = true
                        }}
                        onCompositionEnd={() => {
                          editingComposingRef.current = false
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (isImeComposing(e, editingComposingRef.current)) return
                            todos.setText(item.id, editing.text)
                            stopEditing()
                          }
                          if (e.key === 'Escape') stopEditing()
                        }}
                        className='min-w-0 flex-1 rounded-md border border-blue-400 bg-white px-2 py-1 text-sm text-slate-800 outline-none'
                      />
                      <div className='flex shrink-0 items-center gap-0.5'>
                        <button
                          type='button'
                          onClick={() => {
                            todos.setText(item.id, editing.text)
                            stopEditing()
                          }}
                          disabled={!editing.text.trim()}
                          title='保存'
                          className='flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40'
                        >
                          <CheckIcon />
                        </button>
                        <button
                          type='button'
                          onClick={stopEditing}
                          title='取消'
                          className='flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition-colors hover:bg-slate-100'
                        >
                          <CancelIcon />
                        </button>
                      </div>
                    </>
                  ) : (
                    <span
                      className={`flex-1 break-words text-sm ${
                        item.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'
                      }`}
                    >
                      {item.text}
                    </span>
                  )}
                  {!isEditing && (
                    <div className='flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100'>
                      <button
                        type='button'
                        onClick={() => startEditing(item.id, item.text)}
                        title='编辑'
                        className='flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-blue-500 hover:text-white'
                      >
                        <EditIcon />
                      </button>
                      <button
                        type='button'
                        onClick={() => todos.remove(item.id)}
                        title='删除'
                        className='flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-500 hover:text-white'
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 底部操作 */}
      <div className='mt-2 flex items-center justify-between border-t border-slate-100 pt-2'>
        <a
          href={`${SITE_URL}`}
          onClick={(e) => {
            e.preventDefault()
            browser.tabs.create({ url: browser.runtime.getURL('/newtab.html#todo') })
          }}
          className='text-[11px] text-slate-400 transition-colors hover:text-blue-600'
        >
          在新标签页打开看板 ↗
        </a>
        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={handleExport}
            className='rounded-md px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700'
          >
            导出
          </button>
          <button
            type='button'
            onClick={() => fileRef.current?.click()}
            className='rounded-md px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700'
          >
            导入
          </button>
          <input
            ref={fileRef}
            type='file'
            accept='application/json,.json'
            className='hidden'
            onChange={handleImport}
          />
        </div>
      </div>

      {/* 轻提示 */}
      {toast && (
        <div className='pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] text-white shadow-lg'>
          {toast}
        </div>
      )}
    </div>
  )
}
