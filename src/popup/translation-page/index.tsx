import { Button, Input, Select } from 'antd'
import { useEffect, useRef, useState } from 'react'

import CopyIcon from '~assets/copy.svg'
import { YoudaoTransRes, youdaoTrans } from '~script/translator-api'

// 翻译页面
const translatePage = (type): void => {
  chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type })
  })
}
// 开发中
const wip = (type): void => {
  chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'wip' })
  })
}

// const test = async (type) => {
//   chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
//     chrome.tabs.executeScript(tabs[0].id, {
//       code: 'document.body.style.backgroundColor = red;',
//     })
//   })
// }

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
    if (input.current) {
      input.current.focus()
    }
    // input && input.current.focus()
  }, [])

  return (
    <div className='w-full'>
      <div className='mb-3 flex w-full justify-between gap-2'>
        <Select
          defaultValue='youdao'
          style={{ width: 100 }}
          onChange={(value) => 0}
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
          className='h-8 flex-1 rounded-md border border-gray-300 px-1'
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
          className='h-8 w-auto bg-slate-700'
          onClick={translate}
          loading={loading === 'trans-loading'}
        >
          查词
        </Button>
      </div>
      {
        // 翻译结果
        result?.translation && (
          <div className='relative max-h-[200px] w-full rounded-md bg-slate-400 p-[10px]'>
            {/* 复制按钮 */}
            <img
              className='absolute top-[10px] right-[10px] w-[20px] cursor-pointer'
              onClick={() => {
                navigator.clipboard.writeText(result.translation[0])
              }}
              src={CopyIcon}
              alt=''
            />
            {/* 翻译的内容区域 */}
            <div className='max-h-[180px] overflow-y-scroll text-left text-sm text-black'>
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
                    <p key={item.key}>{`${item.key}： ${item.value.join()}`}</p>
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

      <div className='mt-2 flex justify-between gap-2'>
        <button className='btn-primary' onClick={async () => translatePage('translate-inline')}>
          整页行间对比翻译
        </button>
        <button className='btn-primary' onClick={async () => translatePage('translate-paragraph')}>
          整页段落对比翻译
        </button>
        {/* TODO */}
        <button className='btn-primary' onClick={wip}>
          整页翻译
        </button>
        <button className='btn-primary' onClick={wip}>
          视频翻译
        </button>
      </div>
    </div>
  )
}

export default TranslatePage
