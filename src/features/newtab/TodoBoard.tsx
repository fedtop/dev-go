/**
 * TODO 看板：以浮层形式打开，三列（待办 / 进行中 / 已完成）。
 * 支持新增、跨列拖拽改状态 / 排序、编辑、删除，及导入导出。
 * 数据通过 useTodos 持久化并跨页面（popup）实时同步。
 */

import { useEffect, useRef, useState } from 'react'

import type { TodoStatus } from '@/utils/settings'
import {
  downloadTodos,
  mergeTodos,
  parseTodos,
  TODO_STATUS_LABEL,
  type DropPosition,
} from '@/features/todo/todo'
import { useTodos } from '@/features/todo/useTodos'

const COLUMNS: { status: TodoStatus; accent: string; dot: string }[] = [
  { status: 'todo', accent: 'text-slate-500', dot: 'bg-slate-400' },
  { status: 'doing', accent: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  { status: 'done', accent: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
]

function PlusIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-3.5 w-3.5 fill-none stroke-current'>
      <path d='M12 5v14M5 12h14' strokeLinecap='round' strokeWidth='2' />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-4 w-4 fill-none stroke-current'>
      <path d='M6 6l12 12M18 6 6 18' strokeLinecap='round' strokeWidth='2' />
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

interface TodoBoardProps {
  onClose: () => void
  onToast: (msg: string) => void
}

export default function TodoBoard({ onClose, onToast }: TodoBoardProps) {
  const todos = useTodos()
  const [drafts, setDrafts] = useState<Record<TodoStatus, string>>({
    todo: '',
    doing: '',
    done: '',
  })
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<TodoStatus | null>(null)
  // 当前悬停的目标卡片与落点（前 / 后），用于显示插入指示线
  const [dropMarker, setDropMarker] = useState<{ id: string; position: DropPosition } | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const addTo = (status: TodoStatus) => {
    const text = drafts[status].trim()
    if (!text) return
    todos.add(text, status)
    setDrafts((d) => ({ ...d, [status]: '' }))
  }

  const handleExport = () => {
    if (todos.items.length === 0) {
      onToast('暂无任务可导出')
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
      onToast(added > 0 ? `已导入 ${added} 个任务` : '没有新任务（已存在的已跳过）')
    } catch (err) {
      onToast(err instanceof Error ? err.message : '导入失败')
    }
  }

  // 拖到列空白处：移到该列末尾并改状态
  const dropToColumn = (status: TodoStatus) => {
    if (dragId) todos.move(dragId, null, status)
    resetDrag()
  }

  // 拖到某卡片上：依据落点插到其前 / 后，并继承该列状态
  const dropToCard = (targetId: string, status: TodoStatus) => {
    if (dragId && dropMarker) todos.move(dragId, targetId, status, dropMarker.position)
    else if (dragId) todos.move(dragId, targetId, status)
    resetDrag()
  }

  const resetDrag = () => {
    setDragId(null)
    setOverCol(null)
    setDropMarker(null)
  }

  // 根据指针在卡片内的垂直位置判断插入到前还是后
  const cardDropPosition = (e: React.DragEvent<HTMLElement>): DropPosition => {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  }

  const remaining = todos.items.filter((i) => i.status !== 'done').length

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm'
      onClick={onClose}
    >
      <div
        className='flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl shadow-slate-900/20 dark:border-slate-700/60 dark:bg-slate-900/95'
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className='relative flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-5 text-white'>
          <div>
            <h2 className='text-lg font-semibold tracking-tight'>任务看板</h2>
            <p className='mt-0.5 text-xs text-white/80'>
              {remaining > 0 ? `还有 ${remaining} 项未完成` : '全部完成，太棒了 🎉'}
            </p>
          </div>
          <div className='flex items-center gap-1.5'>
            <button
              type='button'
              onClick={handleExport}
              className='rounded-lg px-2.5 py-1 text-xs text-white/90 transition-colors hover:bg-white/20'
            >
              导出
            </button>
            <button
              type='button'
              onClick={() => fileRef.current?.click()}
              className='rounded-lg px-2.5 py-1 text-xs text-white/90 transition-colors hover:bg-white/20'
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
            <button
              type='button'
              onClick={onClose}
              title='关闭'
              className='ml-1 flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/20'
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* 三列看板 */}
        <div className='grid flex-1 grid-cols-1 gap-4 overflow-y-auto bg-slate-50/60 p-5 sm:grid-cols-3 dark:bg-slate-950/40'>
          {COLUMNS.map((col) => {
            const colItems = todos.items.filter((i) => i.status === col.status)
            const isOver = overCol === col.status
            return (
              <div
                key={col.status}
                onDragOver={(e) => {
                  if (dragId) {
                    e.preventDefault()
                    setOverCol(col.status)
                    // 在卡片上时由卡片处理器接管（已 stopPropagation）；
                    // 能到这里说明在空白处，清除卡片插入标记。
                    setDropMarker(null)
                  }
                }}
                onDragLeave={(e) => {
                  // 仅当真正离开列容器时清除高亮
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOverCol(null)
                    setDropMarker(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  dropToColumn(col.status)
                }}
                className={`flex flex-col rounded-2xl border p-3 transition-colors ${
                  isOver
                    ? 'border-blue-400 bg-blue-50/80 dark:border-blue-500 dark:bg-blue-950/30'
                    : 'border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60'
                }`}
              >
                {/* 列头 */}
                <div className='mb-3 flex items-center gap-2 px-1'>
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <h3 className={`text-xs font-semibold uppercase tracking-wider ${col.accent}`}>
                    {TODO_STATUS_LABEL[col.status]}
                  </h3>
                  <span className='ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400'>
                    {colItems.length}
                  </span>
                </div>

                {/* 卡片列表 */}
                <div className='flex min-h-[60px] flex-1 flex-col gap-2'>
                  {colItems.map((item) => {
                    const isEditing = editing?.id === item.id
                    const marker = dropMarker?.id === item.id ? dropMarker.position : null
                    return (
                      <div
                        key={item.id}
                        draggable={!isEditing}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          setDragId(item.id)
                        }}
                        onDragOver={(e) => {
                          if (!dragId || dragId === item.id) return
                          e.preventDefault()
                          e.stopPropagation()
                          setOverCol(col.status)
                          setDropMarker({ id: item.id, position: cardDropPosition(e) })
                        }}
                        onDrop={(e) => {
                          if (!dragId) return
                          e.preventDefault()
                          e.stopPropagation()
                          dropToCard(item.id, col.status)
                        }}
                        onDragEnd={resetDrag}
                        className={`group relative cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 ${
                          dragId === item.id ? 'opacity-40' : ''
                        } ${
                          marker === 'before'
                            ? 'before:absolute before:-top-1 before:left-0 before:right-0 before:h-0.5 before:rounded-full before:bg-blue-500'
                            : ''
                        } ${
                          marker === 'after'
                            ? 'after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-blue-500'
                            : ''
                        }`}
                      >
                        {isEditing ? (
                          <div className='flex items-center gap-1.5'>
                            <input
                              autoFocus
                              value={editing.text}
                              onChange={(e) => setEditing({ id: item.id, text: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  todos.setText(item.id, editing.text)
                                  setEditing(null)
                                }
                                if (e.key === 'Escape') setEditing(null)
                              }}
                              className='min-w-0 flex-1 rounded-md border border-blue-400 bg-white px-2 py-1 text-sm text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-100'
                            />
                            <button
                              type='button'
                              onClick={() => {
                                todos.setText(item.id, editing.text)
                                setEditing(null)
                              }}
                              disabled={!editing.text.trim()}
                              title='保存'
                              className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40'
                            >
                              <CheckIcon />
                            </button>
                            <button
                              type='button'
                              onClick={() => setEditing(null)}
                              title='取消'
                              className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                            >
                              <CancelIcon />
                            </button>
                          </div>
                        ) : (
                          <p
                            className={`break-words pr-12 text-sm ${
                              col.status === 'done'
                                ? 'text-slate-400 line-through dark:text-slate-500'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {item.text}
                          </p>
                        )}
                        {!isEditing && (
                          <div className='absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
                            <button
                              type='button'
                              onClick={() => setEditing({ id: item.id, text: item.text })}
                              title='编辑'
                              className='flex h-5 w-5 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-blue-500 hover:text-white'
                            >
                              <EditIcon />
                            </button>
                            <button
                              type='button'
                              onClick={() => todos.remove(item.id)}
                              title='删除'
                              className='flex h-5 w-5 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-500 hover:text-white'
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 列内快速添加 */}
                <div className='mt-2 flex items-center gap-1.5'>
                  <input
                    value={drafts[col.status]}
                    onChange={(e) => setDrafts((d) => ({ ...d, [col.status]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addTo(col.status)}
                    placeholder='添加任务…'
                    className='min-w-0 flex-1 rounded-lg border border-transparent bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:bg-white dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-800'
                  />
                  <button
                    type='button'
                    onClick={() => addTo(col.status)}
                    disabled={!drafts[col.status].trim()}
                    title='添加'
                    className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40'
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 底部提示 */}
        <div className='border-t border-slate-100 px-6 py-2.5 text-center text-[11px] text-slate-400 dark:border-slate-800'>
          拖拽卡片可在列间移动 / 排序 · 悬停卡片可编辑或删除 · Esc 关闭
        </div>
      </div>
    </div>
  )
}
