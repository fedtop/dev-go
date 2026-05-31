import type { FC, ReactNode } from 'react'

interface FloatButtonProps {
  icon: ReactNode
  title: string
  /** 是否只显示图标（用于回到顶部这类纯图标按钮） */
  iconOnly?: boolean
  onClick?: () => void
}

/**
 * GitHub 页面右侧悬浮按钮，统一风格。
 * 用 GitHub 自身的主题变量着色，自动适配明/暗色主题。
 */
const FloatButton: FC<FloatButtonProps> = ({ icon, title, iconOnly = false, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    title={title}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: iconOnly ? 0 : '6px',
      justifyContent: 'center',
      padding: iconOnly ? '0' : '0 12px',
      height: '34px',
      width: iconOnly ? '34px' : 'auto',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 500,
      lineHeight: 1,
      color: 'var(--fgColor-default, var(--color-fg-default, #1f2328))',
      background: 'var(--bgColor-default, var(--color-canvas-default, #fff))',
      border: '1px solid var(--borderColor-default, var(--color-border-default, #d0d7de))',
      borderRadius: '8px',
      boxShadow: 'var(--shadow-resting-medium, 0 1px 3px rgba(0,0,0,0.12))',
      transition: 'border-color 0.15s, color 0.15s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--fgColor-accent, #0969da)'
      e.currentTarget.style.color = 'var(--fgColor-accent, #0969da)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor =
        'var(--borderColor-default, var(--color-border-default, #d0d7de))'
      e.currentTarget.style.color = 'var(--fgColor-default, var(--color-fg-default, #1f2328))'
    }}
  >
    <span style={{ fontSize: '16px', display: 'flex' }}>{icon}</span>
    {!iconOnly && <span>{title}</span>}
  </button>
)

export default FloatButton
