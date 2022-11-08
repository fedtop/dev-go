import { googleTrans, youdaoTrans } from '~script/translator'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🚀🚀🚀 / message', message)
  // 翻译
  googleTrans(message.text).then((text) => {
    sendResponse({ text })
  })
  // 等待响应保持通道打开
  return true
})

// 监听命令执行事件
chrome.commands.onCommand.addListener((command) => {
  // console.log(`Command: ${command}`)
})

// 监听tab页面加载状态，添加处理事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 设置判断条件，页面加载完成才添加事件，否则会导致事件重复添加触发多次
  // if (changeInfo.status === 'complete' && /^http/.test(tab.url)) {
  //   // chrome.scripting
  //   //   .executeScript({
  //   //     target: { tabId: tabId },
  //   //     files: ["./content-script.js"]
  //   //   })
  //   //   .then(() => {
  //   //     console.log("INJECTED SCRIPT SUCC.")
  //   //   })
  //   //   .catch((err) => console.log(err))
  // }
})

// 用户首次安装插件时执行一次，后面不会再重新执行。(除非用户重新安装插件)
chrome.runtime.onInstalled.addListener(() => {
  // 插件功能安装默认启用
  // chrome.storage.sync.set({
  //   linkOpen: true
  // })
  console.log('onInstalled')
})

async function translate(text) {
  // const res = await youdaoTrans(text)
  const res = await googleTrans(text)
  return res
}
