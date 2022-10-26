import { googleTrans, youdaoTrans } from "~script/translator"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 翻译
  googleTrans(message.text).then((text) => {
    sendResponse({ text })
  })
  // 等待响应保持通道打开
  return true
})

async function translate(text) {
  // const res = await youdaoTrans(text)
  const res = await googleTrans(text)
  return res
}

console.log("HELLO WORLD FROM BGSCRIPTS")
