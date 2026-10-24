/**
 * 后台 Service Worker 入口：只负责注册监听，具体逻辑见 src/background/。
 *
 * MV3 的 Service Worker 随时可能被回收后重启，所有事件监听都必须在这里同步注册，
 * 否则唤醒 SW 的那个事件会丢失。
 */
import { createContextMenus, registerCommands } from '@/background/commands'
import {
  proxyCorsRequest,
  syncCorsBypassRules,
  syncCorsBypassRulesSafely,
  syncMicrosoftRequestRulesSafely,
} from '@/background/cors'
import {
  clearMediaResources,
  downloadMediaResource,
  getMediaResources,
  registerMediaSniffer,
} from '@/background/media'
import { ensureStorageMigrated } from '@/background/migration'
import {
  applyNetworkMode,
  downloadNetworkRuleList,
  getNetworkStatus,
  registerProxyWatchers,
  syncNetworkProxy,
  syncNetworkProxySafely,
} from '@/background/proxy'
import { registerMessageRouter } from '@/background/router'
import {
  listLlmModels,
  lookupWord,
  testTranslate,
  translateSelectionText,
} from '@/background/translate'
import { handleTranslatePort } from '@/features/translate/port-server'
import { updateNetworkActionIconSafely } from '@/utils/actionIcon'
import { restoreDevBackupIfNeeded } from '@/utils/dev-backup'
import { TRANSLATE_PORT_NAME } from '@/utils/messaging'
import { enableCorsBypass, networkMode, networkProxyManaged } from '@/utils/settings'
import { startSyncMirror, syncNow } from '@/utils/sync-mirror'

export default defineBackground(() => {
  // 跨设备同步：监听需同步执行注册；首次对账等存储迁移完成后再进行
  const syncMirror = startSyncMirror()
  ensureStorageMigrated()
    .catch(() => undefined)
    .then(() => syncMirror.reconcileAll())
    .catch((error: unknown) => console.warn('[DevGo] initial sync failed:', error))

  restoreDevBackupIfNeeded().catch((error) => {
    console.warn('[DevGo] failed to import devgo-backup.json:', error)
  })

  // 来自内容脚本 / Popup / 选项页的请求
  registerMessageRouter({
    translate: (message) => translateSelectionText(message.text),
    lookup: (message) => lookupWord(message.word),
    'test-translate': (message) => testTranslate(message),
    'list-llm-models': (message) => listLlmModels(message.baseUrl, message.apiKey),
    'sync-now': () => syncNow(),
    'open-options-page': () =>
      browser.runtime.openOptionsPage().then(
        () => ({ ok: true }),
        () => ({ ok: false }),
      ),
    'sync-cors-bypass': () => syncCorsBypassRules(),
    'cors-proxy-fetch': (message) => proxyCorsRequest(message.request),
    'apply-network-mode': (message) => applyNetworkMode(message.mode),
    'sync-network-proxy': () => syncNetworkProxy(),
    'get-network-status': () => getNetworkStatus(),
    'download-network-rule-list': (message) => downloadNetworkRuleList(message.url),
    'get-media-resources': (message) => getMediaResources(message.tabId, message.includeDom),
    'clear-media-resources': (message) => clearMediaResources(message.tabId),
    'download-media-resource': (message) =>
      downloadMediaResource(message.url, message.fileName, message.mime, message.saveAs),
  })

  // 整页翻译长连接：每个内容脚本一条，按段流式回传译文
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === TRANSLATE_PORT_NAME) handleTranslatePort(port)
  })

  registerMediaSniffer()
  registerCommands()
  registerProxyWatchers()

  // 安装 / 更新时初始化（右键菜单需在此创建，避免 SW 重启时重复创建报错）
  browser.runtime.onInstalled.addListener(() => {
    createContextMenus()
    syncCorsBypassRulesSafely()
    syncMicrosoftRequestRulesSafely()
  })

  browser.runtime.onStartup.addListener(() => {
    syncCorsBypassRulesSafely()
    syncMicrosoftRequestRulesSafely()
    syncNetworkProxySafely()
  })

  enableCorsBypass.watch(syncCorsBypassRulesSafely)

  // 工具栏图标随网络模式变色（SW 每次启动都重设，避免动态图标丢失）
  updateNetworkActionIconSafely()
  networkMode.watch(updateNetworkActionIconSafely)
  networkProxyManaged.watch(updateNetworkActionIconSafely)
})
