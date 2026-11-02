/**
 * 后台 Service Worker 入口：只负责注册监听，具体逻辑见 src/background/。
 *
 * MV3 的 Service Worker 随时可能被回收后重启，所有事件监听都必须在这里同步注册，
 * 否则唤醒 SW 的那个事件会丢失。
 */
import {
  handleSelectionAiPort,
  registerOpenAssistantListener,
  testAssistant,
} from '@/background/ai'
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
  getWebrtcStatus,
  registerWebrtcWatchers,
  syncWebrtcSafely,
  testWebrtcLeak,
} from '@/background/webrtc'
import {
  aiLookup,
  listLlmModels,
  lookupWord,
  testTranslate,
  translateSelectionText,
} from '@/background/translate'
import { handleTranslatePort } from '@/features/translate/port-server'
import { updateNetworkActionIconSafely } from '@/utils/actionIcon'
import { restoreDevBackupIfNeeded } from '@/utils/dev-backup'
import { SELECTION_AI_PORT_NAME, TRANSLATE_PORT_NAME } from '@/utils/messaging'
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

  // 划词「问 AI」打开侧边栏：需要同步处理以保留用户手势，先于异步路由注册
  registerOpenAssistantListener()

  // 来自内容脚本 / Popup / 选项页的请求
  registerMessageRouter({
    translate: (message) => translateSelectionText(message.text),
    lookup: (message) => lookupWord(message.word),
    'ai-lookup': (message) => aiLookup(message.text),
    'test-translate': (message) => testTranslate(message),
    'list-llm-models': (message) => listLlmModels(message.baseUrl, message.apiKey),
    'test-assistant': (message) => testAssistant(message.llm, message.apiKey),
    'sync-now': () => syncNow(),
    'open-options-page': () =>
      browser.runtime.openOptionsPage().then(
        () => ({ ok: true }),
        () => ({ ok: false }),
      ),
    'sync-cors-bypass': () => syncCorsBypassRules(),
    'get-webrtc-status': () => getWebrtcStatus(),
    'test-webrtc-leak': () => testWebrtcLeak(),
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

  // 长连接：整页翻译（每个内容脚本一条，按段流式回传）与划词 AI 动作（每次动作一条）
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === TRANSLATE_PORT_NAME) handleTranslatePort(port)
    else if (port.name === SELECTION_AI_PORT_NAME) handleSelectionAiPort(port)
  })

  registerMediaSniffer()
  registerCommands()
  registerProxyWatchers()
  registerWebrtcWatchers()

  // 安装 / 更新时初始化（右键菜单需在此创建，避免 SW 重启时重复创建报错）
  browser.runtime.onInstalled.addListener(() => {
    createContextMenus()
    syncCorsBypassRulesSafely()
    syncMicrosoftRequestRulesSafely()
    syncWebrtcSafely()
  })

  browser.runtime.onStartup.addListener(() => {
    syncCorsBypassRulesSafely()
    syncMicrosoftRequestRulesSafely()
    syncNetworkProxySafely()
    syncWebrtcSafely()
  })

  enableCorsBypass.watch(syncCorsBypassRulesSafely)

  // 工具栏图标随网络模式变色（SW 每次启动都重设，避免动态图标丢失）
  updateNetworkActionIconSafely()
  networkMode.watch(updateNetworkActionIconSafely)
  networkProxyManaged.watch(updateNetworkActionIconSafely)
})
