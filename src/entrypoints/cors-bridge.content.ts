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
    await injectScript('/cors-proxy.js' as ScriptPublicPath, {
      modifyScript(script) {
        script.async = false
      },
    }).catch((error) => {
      console.warn('[DevGo] inject CORS proxy failed:', error)
    })

    postEnabled(await enableCorsBypass.getValue())

    const unwatch = enableCorsBypass.watch((enabled) => {
      postEnabled(Boolean(enabled))
    })

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

    window.addEventListener('message', onMessage)
    ctx.onInvalidated(() => {
      window.removeEventListener('message', onMessage)
      unwatch()
    })
  },
})
