import { Button, Input, Select } from 'antd'
import { useEffect, useRef, useState } from 'react'

import CopyIcon from '~assets/copy.svg'
import { YoudaoTransRes, youdaoTrans } from '~script/translator'

// 翻译页面
const translatePage = async (type) => {
  chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type })
  })
}

const { TextArea } = Input
function TranslatePage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState({} as YoudaoTransRes)
  const [loading, setLoading] = useState('')
  // 翻译
  const translate = async () => {
    setLoading('trans-loading')
    const res = await youdaoTrans(text)
    setResult(res)
    setLoading('')
  }

  // 朗读
  const readText = async (url?: string) => {
    if (!url) {
      const msg = new SpeechSynthesisUtterance()
      msg.text = result.translation[0] || 'hello world' // 你要朗读的文本
      msg.lang = 'zh-CN' // 语言
      msg.volume = 1 // 音量，范围 0 ~ 1
      msg.rate = 0.8 // 语速，范围 0.1 ~ 10
      msg.pitch = 1 // 音调，范围 0 ~ 2
      speechSynthesis.speak(msg) // 朗读
      return
    }
    const audio = new Audio(url)
    audio.play()
  }

  // TODO ↓
  //  YouTube 视频翻译
  //  整页翻译

  // react 页面加载完成时，输入框自动获取焦点
  const input = useRef(null)
  useEffect(() => {
    input.current.focus()
  }, [])

  return (
    <div className='w-full'>
      <div className='my-3 w-full gap-2 flex justify-between'>
        <Select
          defaultValue='youdao'
          style={{ width: 100 }}
          onChange={(value) => {}}
          options={[
            {
              value: 'youdao',
              label: ' 有道',
            },
            {
              value: 'Google',
              label: ' Google',
            },
          ]}
        />
        <TextArea
          className='flex-1 h-8 px-1 rounded-md border border-gray-300'
          rows={1}
          placeholder='请输入单词/短句'
          onChange={(e) => setText(e.target.value)}
          value={text}
          ref={input}
          name=''
          id=''
          onPressEnter={(e) => {
            // 取消默认行为
            e.preventDefault()
            translate()
          }}
        />

        <Button
          type='primary'
          className='bg-slate-700 w-auto h-8'
          onClick={translate}
          loading={loading === 'trans-loading'}
        >
          查词
        </Button>
      </div>
      {
        // 翻译结果
        result?.translation && (
          <div className='w-full max-h-[200px] rounded-md bg-slate-400 p-[10px] relative'>
            {/* 复制按钮 */}
            <img
              className='w-[20px] absolute top-[10px] right-[10px] cursor-pointer'
              onClick={() => {
                navigator.clipboard.writeText(result.translation[0])
              }}
              src={CopyIcon}
              alt=''
            />
            {/* 翻译的内容区域 */}
            <div className='text-left text-black text-sm max-h-[180px] overflow-y-scroll'>
              <div className='flex justify-start gap-4'>
                <span className='text-base font-bold'>翻译结果：</span>
                {/* 发音 */}

                {result?.basic?.phonetic && (
                  <div className='flex gap-4'>
                    <span className='cursor-pointer' onClick={() => readText(result.speakUrl)}>
                      📢 {result.basic.phonetic}
                    </span>
                    <span className='cursor-pointer' onClick={() => readText(result.tSpeakUrl)}>
                      📢 {result.translation[0]}
                    </span>
                  </div>
                )}
                <span className='cursor-pointer' onClick={() => readText()}>
                  📢 默认
                </span>
              </div>

              {result?.translation && (
                <p>
                  <span className='text-pink-600'>机器翻译：</span>
                  {result.translation}
                </p>
              )}
              {result?.web?.length > 1 && (
                <div>
                  <p className='text-yellow-300'>网咯释义：</p>
                  {result.web.map((item) => (
                    <p>{`${item.key}： ${item.value.join()}`}</p>
                  ))}
                </div>
              )}
              {result?.basic?.explains && (
                <div>
                  <p className='text-blue-600'>释义：</p>
                  <p>{result.basic.explains}</p>
                </div>
              )}
            </div>
          </div>
        )
      }

      <hr />

      <div className='flex my-4 gap-2 justify-between'>
        <button className='btn-primary' onClick={() => translatePage('inline')}>
          整页行间对比翻译
        </button>
        <button className='btn-primary' onClick={() => translatePage('paragraph')}>
          整页段落对比翻译
        </button>
        <button className='btn-primary' onClick={() => translatePage('paragraph')}>
          整页翻译(wip...)
        </button>

        {/* TODO */}
        {/* <button className='btn-primary' onClick={() => googleTransPage}>
          谷歌整页翻译
        </button> */}
        {/* <button className='btn-primary' onClick={translateYoutube}>
          YouTube视频翻译
        </button> */}
      </div>
    </div>
  )
}

export default TranslatePage
