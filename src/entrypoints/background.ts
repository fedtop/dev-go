import { microsoftLookup, microsoftTrans, testMicrosoftTrans } from '@/api/microsoft'
import { googleLookup, googleTrans, testGoogleTrans } from '@/api/translator'
import { HELP_URL } from '@/utils/constants'
import { sendTabMessage, type RuntimeMessage } from '@/utils/messaging'
import { translateProvider } from '@/utils/settings'
import type { DictResult } from '@/types/dict'

/** 按当前所选引擎翻译文本；html=true 时尽量保留内联标签（仅微软支持） */
async function translateText(text: string, html = false): Promise<string> {
  const provider = await translateProvider.getValue()
  if (provider === 'google') {
    // 谷歌免费接口不支持 HTML 模式；如传入 HTML 则去标签后翻译纯文本
    const plain = html ? text.replace(/<[^>]+>/g, '') : text
    return googleTrans(plain)
  }
  return microsoftTrans(text, html)
}

/** 按当前所选引擎查词典 */
async function lookupWord(word: string): Promise<DictResult | null> {
  const provider = await translateProvider.getValue()
  return provider === 'google' ? googleLookup(word) : microsoftLookup(word)
}

/** 按当前所选引擎测试连通性 */
async function testProvider(): Promise<boolean> {
  const provider = await translateProvider.getValue()
  return provider === 'google' ? testGoogleTrans() : testMicrosoftTrans()
}

export default defineBackground(() => {
  // 监听来自内容脚本 / Popup 的请求消息
  browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (message?.type === 'test') {
      // 测试当前引擎连通性
      testProvider().then(sendResponse)
      return true // 保持消息通道打开以等待异步响应
    }

    if (message?.type === 'translate') {
      // 通过当前所选引擎翻译文本
      translateText(message.text, message.html).then((text) => sendResponse({ text }))
      return true
    }

    if (message?.type === 'lookup') {
      // 通过当前所选引擎查词典
      lookupWord(message.word).then(sendResponse)
      return true
    }

    return false
  })

  // 右键菜单点击 -> 通知当前页面进行整页对比翻译
  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'inline-translate') {
      sendTabMessage({ type: 'translate-page' })
    }
  })

  // 快捷键命令 -> 通知当前页面进行整页对比翻译
  browser.commands.onCommand.addListener((command) => {
    if (command === 'inline-translate') {
      sendTabMessage({ type: 'translate-page' })
    }
  })

  // 安装 / 更新时初始化（右键菜单需在此创建，避免 SW 重启时重复创建报错）
  browser.runtime.onInstalled.addListener(({ reason }) => {
    browser.contextMenus.create({
      id: 'inline-translate',
      title: '对比翻译',
      contexts: ['page', 'selection'],
    })

    // 首次安装时打开使用帮助
    if (reason === 'install' && import.meta.env.PROD) {
      browser.tabs.create({ url: HELP_URL })
    }
  })
})
