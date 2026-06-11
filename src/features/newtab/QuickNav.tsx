/**
 * 快捷导航卡片栅格：展示 + 增 / 删 / 改，数据持久化到 storage。
 */

import { useLayoutEffect, useRef, useState } from 'react'

import type { QuickNavCategoryId, QuickNavCategoryLabels, QuickNavItem } from '@/utils/settings'
import { categoryOf, labelOf, QUICK_NAV_CATEGORIES } from './categories'
import { normalizeNavUrl, openBrowserInternalUrl } from './navUrl'
import { PinIcon } from './PinnedNav'
import SiteIcon from './SiteIcon'

interface QuickNavProps {
  /** 全量导航列表（含所有分类），onChange 也回传全量 */
  items: QuickNavItem[]
  activeCategory: QuickNavCategoryId
  categoryLabels: QuickNavCategoryLabels
  onChange: (items: QuickNavItem[]) => void
  /** 固定 / 取消固定（上限校验在 NewTabApp） */
  onTogglePin: (id: string) => void
}

interface EditState {
  id: string | null // null 表示新增
  title: string
  url: string
  category: QuickNavCategoryId
}

const EMPTY: EditState = { id: null, title: '', url: '', category: 'common' }

type DropPosition = 'before' | 'after'
const REORDER_ANIMATION_MS = 180

export default function QuickNav({
  items,
  activeCategory,
  categoryLabels,
  onChange,
  onTogglePin,
}: QuickNavProps) {
  const [edit, setEdit] = useState<EditState | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragItems, setDragItems] = useState<QuickNavItem[] | null>(null)
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const pendingRects = useRef<Map<string, DOMRect> | null>(null)
  const animationFrame = useRef<number | null>(null)
  const visibleItems = items.filter((item) => categoryOf(item) === activeCategory)
  const displayItems = dragItems ?? visibleItems

  const openAdd = () => setEdit({ ...EMPTY, category: activeCategory })
  const openEdit = (item: QuickNavItem) =>
    setEdit({ id: item.id, title: item.title, url: item.url, category: categoryOf(item) })

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id))

  const readItemRects = () => {
    const rects = new Map<string, DOMRect>()
    itemRefs.current.forEach((node, id) => {
      rects.set(id, node.getBoundingClientRect())
    })
    return rects
  }

  useLayoutEffect(() => {
    const fromRects = pendingRects.current
    pendingRects.current = null

    if (!fromRects) return undefined
    if (animationFrame.current != null) cancelAnimationFrame(animationFrame.current)

    itemRefs.current.forEach((node) => {
      const element = node
      element.style.transition = 'none'
      element.style.transform = ''
    })

    const nextRects = readItemRects()

    const animations: Array<{ node: HTMLDivElement; dx: number; dy: number }> = []
    nextRects.forEach((rect, id) => {
      const previous = fromRects.get(id)
      const node = itemRefs.current.get(id)
      if (!previous || !node) return

      const dx = previous.left - rect.left
      const dy = previous.top - rect.top
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        animations.push({ node, dx, dy })
      }
    })

    animations.forEach((animation) => {
      const element = animation.node
      element.style.transition = 'none'
      element.style.transform = `translate(${animation.dx}px, ${animation.dy}px)`
    })

    if (animations.length > 0) {
      // Force layout so the browser starts from the inverted transform.
      animations.forEach((animation) => animation.node.getBoundingClientRect())
      animationFrame.current = requestAnimationFrame(() => {
        animations.forEach((animation) => {
          const element = animation.node
          element.style.transition = `transform ${REORDER_ANIMATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
          element.style.transform = ''
        })
        animationFrame.current = null
      })
    }

    return undefined
  }, [displayItems])

  const getDropPosition = (e: React.DragEvent<HTMLElement>): DropPosition => {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  }

  const isSameOrder = (a: QuickNavItem[], b: QuickNavItem[]) =>
    a.length === b.length && a.every((item, index) => item.id === b[index]?.id)

  const reorderItems = (
    sourceItems: QuickNavItem[],
    sourceId: string,
    targetId: string,
    position: DropPosition,
  ): QuickNavItem[] => {
    if (sourceId === targetId) return sourceItems
    const sourceIndex = sourceItems.findIndex((item) => item.id === sourceId)
    const targetIndex = sourceItems.findIndex((item) => item.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return sourceItems

    const next = [...sourceItems]
    const [source] = next.splice(sourceIndex, 1)
    const baseIndex = position === 'after' ? targetIndex + 1 : targetIndex
    const insertIndex = sourceIndex < baseIndex ? baseIndex - 1 : baseIndex
    next.splice(Math.max(0, Math.min(insertIndex, next.length)), 0, source)
    return next
  }

  const resetDrag = () => {
    setDraggingId(null)
    setDragItems(null)
  }

  const previewReorder = (targetId: string, position: DropPosition) => {
    if (!draggingId || draggingId === targetId) return
    const next = reorderItems(displayItems, draggingId, targetId, position)
    if (isSameOrder(displayItems, next)) return
    pendingRects.current = readItemRects()
    setDragItems(next)
  }

  /** 把分类内的新顺序回填到全量列表：当前分类的槽位依次填入新顺序，其他分类位置不动 */
  const mergeBack = (all: QuickNavItem[], ordered: QuickNavItem[]): QuickNavItem[] => {
    const queue = [...ordered]
    return all.map((item) => (categoryOf(item) === activeCategory ? queue.shift()! : item))
  }

  const commitDrag = () => {
    if (dragItems && !isSameOrder(visibleItems, dragItems)) onChange(mergeBack(items, dragItems))
    resetDrag()
  }

  const openItem = (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (!openBrowserInternalUrl(url)) return
    event.preventDefault()
  }

  const save = () => {
    if (!edit) return
    const title = edit.title.trim()
    const url = normalizeNavUrl(edit.url)
    if (!title || !url) return
    if (edit.id) {
      onChange(
        items.map((i) => (i.id === edit.id ? { ...i, title, url, category: edit.category } : i)),
      )
    } else {
      onChange([...items, { id: crypto.randomUUID(), title, url, category: edit.category }])
    }
    setEdit(null)
  }

  return (
    <div className='w-full'>
      <div
        className='grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
        onDragOver={(e) => {
          if (draggingId) e.preventDefault()
        }}
        onDrop={(e) => {
          if (!draggingId) return
          e.preventDefault()
          commitDrag()
        }}
      >
        {displayItems.map((item) => {
          const isDragging = draggingId === item.id

          return (
            <div
              key={item.id}
              ref={(node) => {
                if (node) itemRefs.current.set(item.id, node)
                else itemRefs.current.delete(item.id)
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', item.id)
                setDraggingId(item.id)
                setDragItems(visibleItems)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (!draggingId || draggingId === item.id) return
                e.dataTransfer.dropEffect = 'move'
                previewReorder(item.id, getDropPosition(e))
              }}
              onDragEnd={resetDrag}
              className='group relative cursor-grab will-change-transform active:cursor-grabbing'
            >
              <a
                href={item.url}
                target='_blank'
                rel='noreferrer'
                onClick={(event) => openItem(event, item.url)}
                className={`flex flex-col items-center gap-2 rounded-2xl border bg-white/70 px-2 py-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md dark:bg-white/[0.06] dark:hover:border-white/10 ${
                  isDragging ? 'scale-95 opacity-40' : ''
                } border-transparent`}
              >
                <SiteIcon url={item.url} title={item.title} className='h-8 w-8 rounded-lg' />
                <span className='line-clamp-1 w-full text-xs text-slate-600 dark:text-slate-300'>
                  {item.title}
                </span>
              </a>
              {/* 固定开关：已固定常显蓝色，未固定悬停浮现 */}
              <button
                type='button'
                title={item.pinned ? '取消固定' : '固定到搜索框下方'}
                onClick={() => onTogglePin(item.id)}
                className={`absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full transition-all ${
                  item.pinned
                    ? 'bg-blue-500/90 text-white hover:bg-blue-400'
                    : 'bg-slate-200/90 text-slate-600 opacity-0 hover:bg-blue-500 hover:text-white group-hover:opacity-100 dark:bg-slate-700 dark:text-slate-200'
                }`}
              >
                <PinIcon className='h-3 w-3' />
              </button>
              {/* 悬停操作 */}
              <div className='absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
                <button
                  type='button'
                  title='编辑'
                  onClick={() => openEdit(item)}
                  className='flex h-5 w-5 items-center justify-center rounded-full bg-slate-200/90 text-[10px] text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200'
                >
                  ✎
                </button>
                <button
                  type='button'
                  title='删除'
                  onClick={() => remove(item.id)}
                  className='flex h-5 w-5 items-center justify-center rounded-full bg-slate-200/90 text-[10px] text-slate-600 hover:bg-red-500 hover:text-white dark:bg-slate-700 dark:text-slate-200'
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}

        {/* 新增卡片 */}
        <button
          type='button'
          onClick={openAdd}
          className='flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-2 py-4 text-slate-400 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-slate-600'
        >
          <span className='text-2xl leading-none'>+</span>
          <span className='text-xs'>添加</span>
        </button>
      </div>

      {/* 编辑弹层 */}
      {edit && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4'
          onClick={() => setEdit(null)}
        >
          <div
            className='w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800'
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className='mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100'>
              {edit.id ? '编辑导航' : '添加导航'}
            </h3>
            <div className='flex flex-col gap-3'>
              <label className='flex flex-col gap-1'>
                <span className='text-xs text-slate-500 dark:text-slate-400'>名称</span>
                <input
                  autoFocus
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  placeholder='GitHub'
                  className='rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                />
              </label>
              <label className='flex flex-col gap-1'>
                <span className='text-xs text-slate-500 dark:text-slate-400'>网址</span>
                <input
                  value={edit.url}
                  onChange={(e) => setEdit({ ...edit, url: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && save()}
                  placeholder='https://github.com'
                  className='rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                />
              </label>
              <div className='flex flex-col gap-1'>
                <span className='text-xs text-slate-500 dark:text-slate-400'>分类</span>
                <div className='flex flex-wrap gap-1.5'>
                  {QUICK_NAV_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      type='button'
                      onClick={() => setEdit({ ...edit, category: category.id })}
                      className={`rounded-full px-3 py-1 text-xs transition-colors ${
                        edit.category === category.id
                          ? 'bg-slate-900/90 font-medium text-white dark:bg-white/90 dark:text-slate-900'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {labelOf(category.id, categoryLabels)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className='mt-5 flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setEdit(null)}
                className='rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
              >
                取消
              </button>
              <button
                type='button'
                onClick={save}
                className='rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500'
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
