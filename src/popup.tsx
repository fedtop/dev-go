import { useEffect, useRef, useState } from 'react'

import { youdaoTrans } from '~script/translator'

import './style.css'

function IndexPopup() {
  const [text, setText] = useState('')
  const [result, setResult] = useState('')

  // 翻译
  const translate = async () => {
    const res = await youdaoTrans(text)
    console.log('🚀🚀🚀 / res', res)
    setResult(res)
  }

  // 翻译页面
  const translatePage = async () => {
    chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {})
    })
  }

  //  YouTube 视频翻译
  const translateYoutube = async () => {
    chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'youtube' })
    })
    console.log('🚀🚀🚀 / translateYoutube')
  }

  // react 页面加载完成时，输入框自动获取焦点
  const input = useRef(null)
  useEffect(() => {
    input.current.focus()
  }, [])

  return (
    <div className='w-80 text-center flex flex-col  p-3'>
      <h1 className='text-slate-800 text-xl font-extrabold'>
        🤖Super extensions
      </h1>

      <div className='my-3 w-full flex justify-between'>
        <textarea
          className='w-[220px] h-8 mr-2 rounded-md border border-gray-300'
          onChange={(e) => setText(e.target.value)}
          value={text}
          ref={input}
          name=''
          id=''
        ></textarea>
        <button className='btn-primary w-auto h-8' onClick={translate}>
          查词
        </button>
      </div>

      <div className='w-full h-40 rounded-md bg-slate-400 p-2 flex justify-start'>
        <div className='text-left text-black text-base w-full'>
          翻译结果：
          <p>{result}</p>
        </div>
        {/* 复制 */}
        <button
          className='btn-info w-[60px] px-0'
          onClick={() => {
            navigator.clipboard.writeText(result)
          }}
        >
          复制
        </button>
      </div>

      <hr />

      <div className='flex my-4 gap-2 justify-between'>
        <button className='btn-primary' onClick={translatePage}>
          整页对比翻译
        </button>
        <button className='btn-primary' onClick={translateYoutube}>
          YouTube视频翻译
        </button>
      </div>

      {/* 快捷方式说明 */}
      <p className='text-left'>
        快捷键 Ctrl + E 快速切换该面板,配合 Tab，回车键快速控制
      </p>
      <a
        href='https://github.com/wangrongding'
        className='underline text-fuchsia-400'
        target={'__blank'}
      >
        Github 🌸
      </a>
    </div>
  )
}

export default IndexPopup
