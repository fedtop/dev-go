import { type CSSProperties, type RefObject, useCallback, useLayoutEffect, useState } from 'react'

export interface FloatingMenuOptions {
  /** 首选方向；空间不足时自动翻转到另一侧 */
  placement?: 'bottom' | 'top'
  /** 菜单最大高度（超出滚动） */
  maxHeight?: number
  /** 首选方向的剩余空间小于该值时考虑翻转 */
  flipThreshold?: number
  /** 触发元素与菜单的间距 */
  gap?: number
  /** 菜单与视口边缘的最小距离 */
  margin?: number
  /** 菜单最小宽度（默认与触发元素同宽） */
  minWidth?: number
}

/**
 * 下拉浮层定位（`position: fixed` + portal）。
 *
 * 扩展 popup 窗口高度固定（最高 600px），浮层超出窗口的部分会被直接裁掉，因此：
 * - 测量触发元素上下的剩余空间，首选方向放不下且另一侧更宽裕时翻转；
 * - 最大高度收敛到可用空间，内容超出时在菜单内部滚动；
 * - 水平方向限制在视口内；滚动、窗口尺寸变化时重新计算。
 */
export function useFloatingMenu(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  {
    placement = 'bottom',
    maxHeight = 280,
    flipThreshold = 160,
    gap = 4,
    margin = 8,
    minWidth,
  }: FloatingMenuOptions = {},
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  const update = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return

    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = window.innerHeight
    const below = viewportHeight - rect.bottom - gap - margin
    const above = rect.top - gap - margin
    const needed = Math.min(maxHeight, flipThreshold)

    const placeTop =
      placement === 'top' ? !(above < needed && below > above) : below < needed && above > below
    const available = Math.max(placeTop ? above : below, 0)

    const width = Math.max(rect.width, minWidth ?? 0)
    const left = Math.min(Math.max(rect.left, margin), viewportWidth - width - margin)

    setStyle({
      left: Math.max(left, margin),
      width,
      maxHeight: Math.min(maxHeight, available),
      ...(placeTop ? { bottom: viewportHeight - rect.top + gap } : { top: rect.bottom + gap }),
    })
  }, [anchorRef, placement, maxHeight, flipThreshold, gap, margin, minWidth])

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' })
      return undefined
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, update])

  return style
}
