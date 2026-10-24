/**
 * CORS 调试：为网页响应补充 CORS 头（DNR 动态规则）、代理页面跨域请求，以及微软翻译所需的 UA 规则。
 */

import type { CorsProxyRequest, CorsProxyResponse } from '@/utils/messaging'
import { enableCorsBypass } from '@/utils/settings'

const CORS_BYPASS_RULE_ID = 9001
const MS_AUTH_UA_RULE_ID = 9002
const MS_TRANSLATE_UA_RULE_ID = 9003
const EDGE_TRANSLATE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
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

function buildMicrosoftRequestRules(): chrome.declarativeNetRequest.Rule[] {
  const initiatorDomains = chrome.runtime.id ? [chrome.runtime.id] : undefined
  const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
    {
      header: 'User-Agent',
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: EDGE_TRANSLATE_UA,
    },
  ]

  return [
    {
      id: MS_AUTH_UA_RULE_ID,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders,
      },
      condition: {
        urlFilter: 'https://edge.microsoft.com/translate/auth',
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
        initiatorDomains,
      },
    },
    {
      id: MS_TRANSLATE_UA_RULE_ID,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders,
      },
      condition: {
        urlFilter: 'https://api-edge.cognitive.microsofttranslator.com/translate',
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
        initiatorDomains,
      },
    },
  ]
}

async function syncMicrosoftRequestRules(): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [MS_AUTH_UA_RULE_ID, MS_TRANSLATE_UA_RULE_ID],
    addRules: buildMicrosoftRequestRules(),
  })
}

export function syncMicrosoftRequestRulesSafely() {
  syncMicrosoftRequestRules().catch((error) => {
    console.warn('[DevGo] sync Microsoft request rules failed:', error)
  })
}

/** 按开关状态安装 / 移除 CORS 动态规则。 */
export async function syncCorsBypassRules(): Promise<boolean> {
  const enabled = await enableCorsBypass.getValue()

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [CORS_BYPASS_RULE_ID],
    addRules: enabled ? [CORS_BYPASS_RULE] : [],
  })

  return enabled
}

export function syncCorsBypassRulesSafely() {
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

export async function proxyCorsRequest(request: CorsProxyRequest): Promise<CorsProxyResponse> {
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
