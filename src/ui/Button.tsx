import { useEffect, useState, type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'default'
  block?: boolean
  loading?: boolean
  loadingDelay?: number
}

/** 胶囊按钮：primary 黑底白字，default 描边 */
export default function Button({
  variant = 'default',
  block = false,
  loading = false,
  loadingDelay = 180,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const [showLoading, setShowLoading] = useState(false)
  const base =
    'relative inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-[transform,background-color,border-color,color] duration-150 ease-out enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
  const styles = variant === 'primary' ? 'popup-btn-primary' : 'popup-btn-default border'
  const spinnerColor =
    variant === 'primary'
      ? 'border-white/40 border-t-white'
      : 'border-neutral-300 border-t-neutral-600'

  useEffect(() => {
    if (!loading) {
      setShowLoading(false)
      return undefined
    }

    const timer = window.setTimeout(() => setShowLoading(true), loadingDelay)
    return () => window.clearTimeout(timer)
  }, [loading, loadingDelay])

  return (
    <button
      type='button'
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${styles} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      <span className={`inline-flex items-center gap-1.5 ${showLoading ? 'opacity-0' : ''}`}>
        {children}
      </span>
      {showLoading && (
        <span
          className={`absolute h-3 w-3 animate-spin rounded-full border-2 ${spinnerColor}`}
          aria-hidden='true'
        />
      )}
    </button>
  )
}
