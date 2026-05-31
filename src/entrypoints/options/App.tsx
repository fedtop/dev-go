import { useState } from 'react'

import { SITE_URL } from '@/utils/constants'

export default function App() {
  const [data, setData] = useState('')

  return (
    <div style={{ background: 'gray', textAlign: 'center' }}>
      <h1 className='bg-gray-700 text-white'>这里是 DevGo 的选项页</h1>
      <input onChange={(e) => setData(e.target.value)} value={data} />
      <p>
        插件使用{' '}
        <a href='https://wxt.dev' target='_blank' rel='noreferrer'>
          WXT
        </a>{' '}
        开发 ·{' '}
        <a href={SITE_URL} target='_blank' rel='noreferrer'>
          GitHub
        </a>
      </p>
    </div>
  )
}
