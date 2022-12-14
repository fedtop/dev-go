import { googleTrans, testGoogleTrans } from '~script/translator-api'
// import injectGoogleTranslate from 'raw:../../assets/google/injection.js'
// console.log('ðð', injectGoogleTranslate) // chrome-extension://<extension-id>/image.<hashA>.png

// çå¬ message äºä»¶
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, text } = message

  if (type === 'test') {
    // æµè¯ç¿»è¯æå¡
    testGoogleTrans().then((res) => {
      sendResponse(res)
    })
  } else {
    // éè¿è°·æ­ç¿»è¯ api ç¿»è¯ææ¬
    googleTrans(text).then((res) => {
      res && sendResponse({ text: res })
      return true
    })
  }
  // ç­å¾ååºä¿æééæå¼
  return true
})

// éç¥ contents ä¸­ç translate.ts ç¿»è¯é¡µé¢
const translatePage = async (type) => {
  chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type })
  })
}

// çå¬å³é®èåç¹å»äºä»¶
chrome.contextMenus.onClicked.addListener((info, tab) => {
  translatePage('translate-inline')
  // if (info.menuItemId === 'trans1')
})

// çå¬å½ä»¤æ§è¡äºä»¶
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command: ${command}`)
  translatePage('translate-inline')
})

// åå»ºå³é®èå
chrome.contextMenus.create({
  id: 'inline-translate',
  title: 'å¯¹æ¯ç¿»è¯',
})

// ç¨æ·é¦æ¬¡å®è£æä»¶æ¶æ§è¡ä¸æ¬¡ï¼åé¢ä¸ä¼åéæ°æ§è¡ã(é¤éç¨æ·éæ°å®è£æä»¶)
chrome.runtime.onInstalled.addListener(() => {
  console.log('onInstalled')
  // æå¼ä½¿ç¨å¸®å©
  if (process.env.NODE_ENV !== 'development') {
    chrome.tabs.create({ url: 'https://github.com/wangrongding/dev-go#devgo' })
  }
})

// çå¬tabé¡µé¢å è½½ç¶æï¼æ·»å å¤çäºä»¶
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // è®¾ç½®å¤æ­æ¡ä»¶ï¼é¡µé¢å è½½å®æææ·»å äºä»¶ï¼å¦åä¼å¯¼è´äºä»¶éå¤æ·»å è§¦åå¤æ¬¡
  if (changeInfo.status === 'complete') {
    // console.log('ððð / onUpdated', changeInfo)
    // chrome.scripting
    //   .executeScript({
    //     target: { tabId },
    //     // files: ['./inject-script.js'],
    //     // files: [injectGoogleTranslate],
    //     files: ['https//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'],
    //     // https://docs.plasmo.com/browser-extension/import#raw
    //   })
    //   .then(() => {
    //     console.log('ððð / inject-script')
    //   })
    //   .catch((err) => console.log(err))
  }
})

// å½åéé¡¹å¡åçååæ¶è§¦å
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('ððð / onActivated', activeInfo)
})
