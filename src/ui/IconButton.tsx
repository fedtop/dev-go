import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 无障碍名称，同时作为悬停提示 */
  label: string
  children: ReactNode
}

/** 只有图标的透明按钮（顶栏操作等），悬停时出现浅灰底 */
export default function IconButton({ label, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type='button'
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-[18px] ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
