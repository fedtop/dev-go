import { microsoftLookup, microsoftTrans, testMicrosoftTrans } from '@/api/microsoft'
import { googleLookup, googleTrans, testGoogleTrans } from '@/api/translator'
import { HELP_URL } from '@/utils/constants'
import {
  sendTabMessage,
  type CorsProxyRequest,
  type CorsProxyResponse,
  type RuntimeMessage,
} from '@/utils/messaging'
import { enableCorsBypass, popupInitialTab, translateProvider } from '@/utils/settings'
import type { DictResult } from '@/types/dict'

const CORS_BYPASS_RULE_ID = 9001
const CORS_RULE_RESOURCE_TYPES = [
  chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
  chrome.declarativeNetRequest.ResourceType.OTHER,
]
const CORS_ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
  'PROPFIND',
  'PROPPATCH',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
].join(', ')
const CORS_ALLOWED_HEADERS = [
  'Accept',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Language',
  'Content-Type',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Unmodified-Since',
  'Origin',
  'Pragma',
  'Range',
  'X-Api-Key',
  'X-Auth-Token',
  'X-Client-Version',
  'X-CSRF-Token',
  'X-HTTP-Method-Override',
  'X-Requested-With',
  'X-Test-Header',
  'X-XSRF-Token',
  '*',
].join(', ')

const CORS_BYPASS_RULE: chrome.declarativeNetRequest.Rule = {
  id: CORS_BYPASS_RULE_ID,
  priority: 1,
  action: {
    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
    responseHeaders: [
      {
        header: 'Access-Control-Allow-Origin',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: '*',
      },
      {
        header: 'Access-Control-Allow-Methods',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: CORS_ALLOWED_METHODS,
      },
      {
        header: 'Access-Control-Allow-Headers',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: CORS_ALLOWED_HEADERS,
      },
      {
        header: 'Access-Control-Allow-Credentials',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: 'true',
      },
      {
        header: 'Access-Control-Expose-Headers',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: '*',
      },
      {
        header: 'Access-Control-Max-Age',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: '86400',
      },
      {
        header: 'Access-Control-Allow-Private-Network',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: 'true',
      },
      {
        header: 'Cross-Origin-Resource-Policy',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: 'cross-origin',
      },
    ],
  },
  condition: {
    urlFilter: '|http',
    resourceTypes: CORS_RULE_RESOURCE_TYPES,
  },
}

/** 按开关状态安装 / 移除 CORS 动态规则。 */
async function syncCorsBypassRules(): Promise<boolean> {
  const enabled = await enableCorsBypass.getValue()

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [CORS_BYPASS_RULE_ID],
    addRules: enabled ? [CORS_BYPASS_RULE] : [],
  })

  return enabled
}

function syncCorsBypassRulesSafely() {
  syncCorsBypassRules().catch((error) => {
    console.warn('[DevGo] sync CORS bypass rules failed:', error)
  })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}

async function proxyCorsRequest(request: CorsProxyRequest): Promise<CorsProxyResponse> {
  if (!(await enableCorsBypass.getValue())) {
    return {
      url: request.url,
      status: 0,
      statusText: '',
      headers: [],
      body: '',
      redirected: false,
      error: 'CORS proxy is disabled',
    }
  }

  try {
    const method = request.method.toUpperCase()
    let requestBody: ArrayBuffer | undefined
    if (method !== 'GET' && method !== 'HEAD' && request.body) {
      requestBody = base64ToArrayBuffer(request.body)
    }

    const response = await fetch(request.url, {
      method,
      headers: request.headers,
      body: requestBody,
      credentials: request.credentials ?? 'include',
      redirect: request.redirect === 'manual' ? 'manual' : 'follow',
    })

    return {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
      body: arrayBufferToBase64(await response.arrayBuffer()),
      redirected: response.redirected,
    }
  } catch (error) {
    return {
      url: request.url,
      status: 0,
      statusText: '',
      headers: [],
      body: '',
      redirected: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

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

    if (message?.type === 'sync-cors-bypass') {
      // 同步 CORS 动态规则，返回实际是否已启用
      syncCorsBypassRules().then(sendResponse)
      return true
    }

    if (message?.type === 'cors-proxy-fetch') {
      proxyCorsRequest(message.request).then(sendResponse)
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

  // 快捷键命令
  browser.commands.onCommand.addListener((command) => {
    if (command === 'inline-translate') {
      sendTabMessage({ type: 'translate-page' })
    } else if (command === 'open-todo') {
      // 打开 popup 并定位到「待办」Tab：先写一次性信号，再主动弹出 popup。
      popupInitialTab.setValue('todo').then(() => {
        browser.action.openPopup?.().catch((error) => {
          console.warn('[DevGo] openPopup failed:', error)
        })
      })
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

    syncCorsBypassRulesSafely()
  })

  browser.runtime.onStartup.addListener(syncCorsBypassRulesSafely)

  enableCorsBypass.watch(syncCorsBypassRulesSafely)
})
