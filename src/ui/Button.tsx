import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'default'
  block?: boolean
  loading?: boolean
}

/** 轻量按钮（替代 antd Button） */
export default function Button({
  variant = 'default',
  block = false,
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
  const styles =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-500'
      : 'border border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-600'

  return (
    <button
      type='button'
      disabled={disabled || loading}
      className={`${base} ${styles} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && (
        <span className='h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white' />
      )}
      {children}
    </button>
  )
}
