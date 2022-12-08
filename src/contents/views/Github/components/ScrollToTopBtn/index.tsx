import type { FC } from 'react'
import Arrow from './arrow'
// import './index.css'

interface ScrollToTopBtnProps {
  onClick: () => void
}

const ScrollToTopBtn: FC<ScrollToTopBtnProps> = (props) => {
  const { onClick } = props

  return (
    <div
      className='scrollToTopBtn'
      style={{
        color: 'var(--color-fg-muted)',
        padding: '3px 5px 0',
        cursor: 'pointer',
        fontSize: '16px',
        background: 'var(--color-btn-bg)',
        position: 'fixed',
        right: '50px',
        bottom: '80px',
        border: '1px solid var(--color-btn-border)',
        borderRadius: '6px',
      }}
      onClick={onClick}
      title='回到顶部'
    >
      <Arrow />
    </div>
  )
}

export default ScrollToTopBtn
