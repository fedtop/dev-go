import { collectPageMediaResources } from '@/features/media/collect-dom'
import { hasExtensionRuntime } from '@/utils/content-settings'
import type { TabMessage } from '@/utils/messaging'

/** 媒体资源采集：响应 popup「资源」面板的 DOM 扫描请求 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    if (!hasExtensionRuntime()) return

    browser.runtime.onMessage.addListener((message: TabMessage, _sender, sendResponse) => {
      if (message?.type === 'collect-media-resources') sendResponse(collectPageMediaResources())
      return undefined
    })
  },
})
