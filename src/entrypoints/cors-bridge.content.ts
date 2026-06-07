import { injectScript, type ScriptPublicPath } from 'wxt/utils/inject-script'
import { sendRuntimeMessage, type CorsProxyRequest } from '@/utils/messaging'
import { enableCorsBypass } from '@/utils/settings'

const PAGE_SOURCE = 'devgo-cors-proxy-page'
const CONTENT_SOURCE = 'devgo-cors-proxy-content'

interface PageProxyRequestMessage {
  source: typeof PAGE_SOURCE
  type: 'request'
  id: string
  request: CorsProxyRequest
}

function isPageProxyRequestMessage(data: unknown): data is PageProxyRequestMessage {
  return (
    typeof data === 'object' &&
    data != null &&
    (data as PageProxyRequestMessage).source === PAGE_SOURCE &&
    (data as PageProxyRequestMessage).type === 'request' &&
    typeof (data as PageProxyRequestMessage).id === 'string'
  )
}

function postEnabled(enabled: boolean) {
  window.postMessage(
    {
      source: CONTENT_SOURCE,
      type: 'state',
      enabled,
    },
    '*',
  )
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main(ctx) {
    // 惰性注入：只有 CORS 补头功能开启时，才把页面脚本注入页面并接管 fetch/XHR。
    // 功能默认关闭，绝大多数页面因此保持原生环境——不替换 window.fetch /
    // window.XMLHttpRequest，DevTools Network 面板也不会被 cors-proxy.js 污染。
    let injected = false

    const onMessage = async (event: MessageEvent) => {
      if (event.source !== window || !isPageProxyRequestMessage(event.data)) return

      try {
        const response = await sendRuntimeMessage({
          type: 'cors-proxy-fetch',
          request: event.data.request,
        })

        window.postMessage(
          {
            source: CONTENT_SOURCE,
            type: 'response',
            id: event.data.id,
            response,
          },
          '*',
        )
      } catch (error) {
        window.postMessage(
          {
            source: CONTENT_SOURCE,
            type: 'response',
            id: event.data.id,
            response: {
              url: event.data.request.url,
              status: 0,
              statusText: '',
              headers: [],
              body: '',
              redirected: false,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          '*',
        )
      }
    }

    // 幂等地完成「注入页面脚本 + 挂载消息桥」。仅在首次开启时执行一次。
    async function ensureInjected() {
      if (injected) return
      injected = true

      window.addEventListener('message', onMessage)
      ctx.onInvalidated(() => window.removeEventListener('message', onMessage))

      await injectScript('/cors-proxy.js' as ScriptPublicPath, {
        modifyScript(script) {
          script.async = false
        },
      }).catch((error) => {
        injected = false
        window.removeEventListener('message', onMessage)
        console.warn('[DevGo] inject CORS proxy failed:', error)
      })
    }

    // 文档开始阶段读取一次开关：开启则立即注入，以尽量赶在页面脚本之前接管 fetch/XHR。
    if (await enableCorsBypass.getValue()) {
      await ensureInjected()
      postEnabled(true)
    }

    const unwatch = enableCorsBypass.watch(async (enabled) => {
      if (enabled) {
        // 运行时才开启：注入后接管的是「此刻之后」发起的请求；页面已缓存的
        // fetch/XHR 引用不受影响，必要时提示用户刷新页面。
        await ensureInjected()
        postEnabled(true)
      } else if (injected) {
        // 关闭：无法移除已注入的页面脚本，但通过状态消息让其变为原生透传，
        // 不再代理任何请求。彻底回到原生环境需刷新页面。
        postEnabled(false)
      }
    })

    ctx.onInvalidated(() => unwatch())
  },
})
