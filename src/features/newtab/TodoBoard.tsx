/**
 * TODO 看板：以浮层形式打开，三列（待办 / 进行中 / 已完成）。
 * 支持新增、跨列拖拽改状态 / 排序、编辑、删除，及导入导出。
 * 数据通过 useTodos 持久化并跨页面（popup）实时同步。
 */

import { useEffect, useRef, useState } from 'react'

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

const COLUMNS: { status: TodoStatus; accent: string; dot: string }[] = [
  { status: 'todo', accent: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' },
  { status: 'doing', accent: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
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
  const draftComposingRef = useRef<Record<TodoStatus, boolean>>({
    todo: false,
    doing: false,
    done: false,
  })
  const editingComposingRef = useRef(false)

  const startEditing = (id: string, text: string) => {
    editingComposingRef.current = false
    setEditing({ id, text })
  }

  const stopEditing = () => {
    editingComposingRef.current = false
    setEditing(null)
  }

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
      className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-md dark:bg-black/40'
      onClick={onClose}
    >
      <div
        className='flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/75 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/30'
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className='flex items-center justify-between gap-4 border-b border-white/60 bg-white/45 px-5 py-4 dark:border-white/10 dark:bg-white/[0.03]'>
          <div className='min-w-0'>
            <h2 className='text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100'>
              TODO
            </h2>
            <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>
              {todos.items.length} 项 · {remaining} 未完成
            </p>
          </div>
          <div className='flex shrink-0 items-center gap-1.5'>
            <button
              type='button'
              onClick={handleExport}
              className='rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100'
            >
              导出
            </button>
            <button
              type='button'
              onClick={() => fileRef.current?.click()}
              className='rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100'
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
              className='ml-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100'
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* 三列看板 */}
        <div className='grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-3'>
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
                className={`flex min-h-[360px] flex-col rounded-2xl border p-3 transition-colors ${
                  isOver
                    ? 'border-sky-300/80 bg-sky-50/60 dark:border-sky-500/50 dark:bg-sky-950/20'
                    : 'border-white/70 bg-slate-50/50 dark:border-white/10 dark:bg-white/[0.035]'
                }`}
              >
                {/* 列头 */}
                <div className='mb-3 flex items-center gap-2 px-1'>
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <h3 className={`text-xs font-semibold ${col.accent}`}>
                    {TODO_STATUS_LABEL[col.status]}
                  </h3>
                  <span className='ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400'>
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
                        className={`group relative cursor-grab rounded-xl border border-white/80 bg-white/75 p-3 shadow-[0_1px_0_rgba(255,255,255,0.9)] transition-colors hover:bg-white/90 active:cursor-grabbing dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.09] ${
                          dragId === item.id ? 'opacity-40' : ''
                        } ${
                          marker === 'before'
                            ? 'before:absolute before:-top-1 before:left-0 before:right-0 before:h-0.5 before:rounded-full before:bg-sky-500'
                            : ''
                        } ${
                          marker === 'after'
                            ? 'after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-sky-500'
                            : ''
                        }`}
                      >
                        {isEditing ? (
                          <div className='flex items-center gap-1.5'>
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
                              className='min-w-0 flex-1 rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-sm text-slate-800 outline-none transition-colors focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-100'
                            />
                            <button
                              type='button'
                              onClick={() => {
                                todos.setText(item.id, editing.text)
                                stopEditing()
                              }}
                              disabled={!editing.text.trim()}
                              title='保存'
                              className='flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900/85 text-white transition-colors hover:bg-slate-800 disabled:opacity-40 dark:bg-white/90 dark:text-slate-950 dark:hover:bg-white'
                            >
                              <CheckIcon />
                            </button>
                            <button
                              type='button'
                              onClick={stopEditing}
                              title='取消'
                              className='flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-white/80 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
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
                              onClick={() => startEditing(item.id, item.text)}
                              title='编辑'
                              className='flex h-5 w-5 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-900/80 hover:text-white dark:hover:bg-white/15'
                            >
                              <EditIcon />
                            </button>
                            <button
                              type='button'
                              onClick={() => todos.remove(item.id)}
                              title='删除'
                              className='flex h-5 w-5 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-500 hover:text-white'
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
                <div className='mt-2 flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/50 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.04]'>
                  <input
                    value={drafts[col.status]}
                    onChange={(e) => setDrafts((d) => ({ ...d, [col.status]: e.target.value }))}
                    onCompositionStart={() => {
                      draftComposingRef.current[col.status] = true
                    }}
                    onCompositionEnd={() => {
                      draftComposingRef.current[col.status] = false
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !isImeComposing(e, draftComposingRef.current[col.status])
                      ) {
                        addTo(col.status)
                      }
                    }}
                    placeholder='添加任务…'
                    className='min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200'
                  />
                  <button
                    type='button'
                    onClick={() => addTo(col.status)}
                    disabled={!drafts[col.status].trim()}
                    title='添加'
                    className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/80 hover:text-slate-900 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
