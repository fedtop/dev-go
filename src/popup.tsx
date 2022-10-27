import { useState } from "react"

import { youdaoTrans } from "~script/translator"

import "./style.css"

function IndexPopup() {
  const [text, setText] = useState("")
  const [result, setResult] = useState("")

  // 翻译
  const translate = async () => {
    const res = await youdaoTrans(text)
    console.log("🚀🚀🚀 / res", res)
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
      chrome.tabs.sendMessage(tabs[0].id, { type: "youtube" })
    })
    console.log("🚀🚀🚀 / translateYoutube")
  }

  return (
    <div className="w-80 text-center flex-col flex p-3">
      <h1 className="text-black text-xl">🚀 Super extensions</h1>
      <div className="my-3 w-full h-10 rounded-md bg-white">
        <input
          className="w-2/3 h-10 rounded-md border border-gray-300"
          onChange={(e) => setText(e.target.value)}
          value={text}
        />
        <button
          className="bg-sky-700 text-white w-1/3 h-10"
          onClick={translate}>
          查词
        </button>
      </div>

      {/* 翻译 */}
      <div className="text-left">{result}</div>

      <button
        className="text-white w-full h-10 rounded-md cursor-pointer my-4 bg-green-800 text-base mx-auto"
        onClick={translatePage}>
        整页翻译
      </button>

      <button
        className="text-white w-full h-10 rounded-md cursor-pointer my-4 bg-green-800 text-base mx-auto"
        onClick={translateYoutube}>
        YouTube 视频翻译
      </button>

      <a
        href="https://github.com/wangrongding"
        className="underline"
        target={"__blank"}>
        Github 🌸
      </a>
    </div>
  )
}

export default IndexPopup
