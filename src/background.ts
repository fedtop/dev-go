import { googleTrans, youdaoTrans } from '~script/translator'

// 翻译页面
const translatePage = async (type) => {
  chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type })
  })
}

// 监听 message 事件
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🚀🚀🚀 / message', message)
  // 翻译
  googleTrans(message.text).then((text) => {
    sendResponse({ text })
    return true
  })
  // 等待响应保持通道打开
  return true
})

// 创建右键菜单
chrome.contextMenus.create({
  id: 'inline-translate',
  title: '行内对比翻译',
})

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  translatePage('inline')
  // if (info.menuItemId === 'trans1')
})

// 监听命令执行事件
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command: ${command}`)
  translatePage('inline')
})

// 用户首次安装插件时执行一次，后面不会再重新执行。(除非用户重新安装插件)
chrome.runtime.onInstalled.addListener(() => {
  console.log('onInstalled')
  // 打开使用帮助
  chrome.tabs.create({ url: 'https://github.com/wangrongding/dev-go#devgo' })
})

// 监听tab页面加载状态，添加处理事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 设置判断条件，页面加载完成才添加事件，否则会导致事件重复添加触发多次
  // if (changeInfo.status === 'complete' && /^http/.test(tab.url)) {
  //   chrome.scripting
  //     .executeScript({
  //       target: { tabId: tabId },
  //       files: ['./content-script.js'],
  //     })
  //     .then(() => {
  //       console.log('INJECTED SCRIPT SUCC.')
  //     })
  //     .catch((err) => console.log(err))
  // }
})

// // 谷歌整页翻译
// function aaa() {
//   var element = document.createElement('script')
//   element.id = 'outfox_seed_js'
//   element.charset = 'utf-8'
//   element.setAttribute(
//     'src',
//     'http://fanyi.youdao.com/web2/seed.js?%27 + Date.parse(new Date()));document.body.appendChild(element);',
//   )
// }
// function googleTranslateElementInit() {
//   new google.translate.TranslateElement(
//     {
//       pageLanguage: 'zh-CN',
//       layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
//       autoDisplay: false,
//     },
//     'google_translate_element'
//   )
// }
