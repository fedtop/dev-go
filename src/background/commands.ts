/**
 * 快捷键命令与右键菜单：打开 popup 并定位到指定 Tab、切换整页翻译。
 */

import {
  sendTabMessage,
  type PopupShortcutMessage,
  type PopupShortcutResponse,
} from '@/utils/messaging'
import {
  defaultPopupTab,
  isPopupShortcutTab,
  popupInitialTab,
  type PopupShortcutTab,
} from '@/utils/settings'

const DEFAULT_POPUP_COMMAND = 'open-default'
const DEFAULT_POPUP_TAB: PopupShortcutTab = 'translate'
const COMMAND_TO_TAB: Record<string, PopupShortcutTab> = {
  'open-network': 'network',
  'open-tools': 'tools',
}
const INLINE_TRANSLATE_ID = 'inline-translate'

function isPopupShortcutResponse(value: unknown): value is PopupShortcutResponse {
  return (
    typeof value === 'object' && value != null && (value as PopupShortcutResponse).handled === true
  )
}

function normalizePopupShortcutTab(value: string): PopupShortcutTab {
  return isPopupShortcutTab(value) ? value : DEFAULT_POPUP_TAB
}

async function getPopupCommandTab(command: string): Promise<PopupShortcutTab | null> {
  if (command === DEFAULT_POPUP_COMMAND) {
    return normalizePopupShortcutTab(await defaultPopupTab.getValue())
  }

  return COMMAND_TO_TAB[command] ?? null
}

async function notifyOpenPopup(tab: PopupShortcutTab): Promise<boolean> {
  try {
    const message: PopupShortcutMessage = {
      type: 'popup-shortcut',
      tab,
      nonce: Date.now(),
    }
    const response = await browser.runtime.sendMessage(message)
    return isPopupShortcutResponse(response)
  } catch {
    return false
  }
}

async function openPopupWithInitialTab(tab: PopupShortcutTab): Promise<void> {
  await popupInitialTab.setValue(tab)

  try {
    await browser.action.openPopup?.()
  } catch (error) {
    console.warn('[DevGo] openPopup failed:', error)
  }
}

async function handlePopupShortcutCommand(command: string): Promise<void> {
  const tab = await getPopupCommandTab(command)
  if (!tab) return

  if (await notifyOpenPopup(tab)) return
  await openPopupWithInitialTab(tab)
}

/** 安装 / 更新时创建右键菜单（只能在 onInstalled 里创建，SW 重启时重复创建会报错） */
export function createContextMenus() {
  browser.contextMenus.create({
    id: INLINE_TRANSLATE_ID,
    title: '翻译当前页面（再次点击恢复原文）',
    contexts: ['page', 'selection'],
  })
}

/** 注册右键菜单点击与快捷键命令监听 */
export function registerCommands() {
  // 右键菜单点击 -> 切换当前页面的整页双语翻译
  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === INLINE_TRANSLATE_ID) {
      void sendTabMessage({ type: 'translate-page' })
    }
  })

  browser.commands.onCommand.addListener((command) => {
    if (command === INLINE_TRANSLATE_ID) {
      void sendTabMessage({ type: 'translate-page' })
      return
    }

    void handlePopupShortcutCommand(command).catch((error) => {
      console.warn('[DevGo] popup shortcut failed:', error)
    })
  })
}
