import { useState } from "react"

import { youdaoTrans } from "~script/translator"

import "./style.css"

function IndexPopup() {
  const [text, setText] = useState("")
  const [result, setResult] = useState("")
  async function translate() {
    const res = await youdaoTrans(text)
    console.log("🚀🚀🚀 / res", res)
    setResult(res)
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 16,
        width: 300,
        textAlign: "center"
      }}>
      <a href="https://github.com/wangrongding" className="" target={"__blank"}>
        Github 🌸
      </a>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          justifyContent: "space-between",
          marginTop: 16,
          marginBottom: 16,
          width: "100%",
          height: 40,
          borderRadius: 4,
          backgroundColor: "#fff",
          gap: "20px",
          alignContent: "space-between"
        }}>
        <input
          style={{
            height: 40,
            borderRadius: 4,
            border: "1px solid #ccc"
          }}
          onChange={(e) => setText(e.target.value)}
          value={text}
        />
        <button className="bg-sky-700 text-white w-20" onClick={translate}>
          查词
        </button>
      </div>

      {/* 翻译 */}
      <div>{result}</div>

      <button
        style={{
          width: "100%",
          height: 40,
          borderRadius: 4,
          backgroundColor: "#108874",
          color: "#fff",
          fontSize: 16,
          cursor: "pointer",
          margin: "0 auto"
        }}
        onClick={() => {
          chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {})
          })
        }}>
        整页翻译
      </button>
    </div>
  )
}

export default IndexPopup
