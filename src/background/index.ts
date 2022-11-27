// import injectGoogleTranslate from 'raw:../../assets/google/injection.js'

import { googleTrans, testGoogleTrans } from '~script/translator-api'

// console.log('😀😀', injectGoogleTranslate) // chrome-extension://<extension-id>/image.<hashA>.png

// 翻译页面
const translatePage = async (type) => {
  chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type })
  })
}

// 监听 message 事件
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, text } = message

  if (type === 'test') {
    // 测试翻译服务
    testGoogleTrans().then((res) => {
      sendResponse(res)
    })
  } else {
    // 翻译
    googleTrans(text).then((text) => {
      sendResponse({ text })
      return true
    })
  }
  // 等待响应保持通道打开
  return true
})

// 创建右键菜单
chrome.contextMenus.create({
  id: 'inline-translate',
  title: '对比翻译',
})

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  translatePage('translate-inline')
  // if (info.menuItemId === 'trans1')
})

// 监听命令执行事件
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command: ${command}`)
  translatePage('translate-inline')
})

// 用户首次安装插件时执行一次，后面不会再重新执行。(除非用户重新安装插件)
chrome.runtime.onInstalled.addListener(() => {
  console.log('onInstalled')
  // 打开使用帮助
  if (process.env.NODE_ENV !== 'development') {
    chrome.tabs.create({ url: 'https://github.com/wangrongding/dev-go#devgo' })
  }
})

// 监听tab页面加载状态，添加处理事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 设置判断条件，页面加载完成才添加事件，否则会导致事件重复添加触发多次
  if (changeInfo.status === 'complete') {
    // console.log('🚀🚀🚀 / onUpdated', changeInfo)
    // chrome.scripting
    //   .executeScript({
    //     target: { tabId },
    //     // files: ['./inject-script.js'],
    //     // files: [injectGoogleTranslate],
    //     files: ['https//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'],
    //     // https://docs.plasmo.com/browser-extension/import#raw
    //   })
    //   .then(() => {
    //     console.log('🚀🚀🚀 / inject-script')
    //   })
    //   .catch((err) => console.log(err))
  }
})

// 当前选项卡发生变化时触发
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('🚀🚀🚀 / onActivated', activeInfo)
})
