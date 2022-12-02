import type { FC } from 'react';

interface OnlineEditBtnProps {
  onClick?: () => void;
  title: string;
}

const OnlineEditBtn: FC<OnlineEditBtnProps> = props => {
  const { onClick, title } = props;
  
  return (
    <button
    onClick={onClick}
    style={{
      color: 'white',
      colorScheme: 'dark',
      fontWeight: 'bold',
      padding: '5px 10px',
      lineHeight: '20px',
      cursor: 'pointer',
      fontSize: '14px',
      background: 'rgb(52, 125, 57)',
      position: 'fixed',
      right: '100px',
      bottom: '100px',
      border: '1px solid rgba(205, 217, 229, 0.1)',
      borderRadius: '6px',
    }}
  >
    {title}
  </button>
  )
}

export default OnlineEditBtn;