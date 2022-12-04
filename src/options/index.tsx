import { useState } from 'react'

function IndexOptions() {
  const [data, setData] = useState('')

  return (
    <>
      <div
        style={{
          background: 'gray',
          textAlign: 'center',
        }}
      >
        <h1 className='bg-gray-700 text-white'>这里是 DevGo 的选项页</h1>
        <input onChange={(e) => setData(e.target.value)} value={data} />
        <p>
          插件使用 <a href='https://www.plasmo.com'>Plasmo</a> 开发
        </p>
      </div>
    </>
  )
}

export default IndexOptions
