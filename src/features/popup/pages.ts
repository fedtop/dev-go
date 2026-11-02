/** popup 面板的 Tab 元数据（App 渲染与设置页「默认打开的页」共用） */

export interface PopupPage {
  value: string
  label: string
}

export const POPUP_PAGES: PopupPage[] = [
  { value: 'translate', label: '翻译' },
  { value: 'network', label: '网络' },
  { value: 'tools', label: '资源' },
  { value: 'function', label: '功能' },
]

export const POPUP_PAGE_VALUES = new Set(POPUP_PAGES.map((p) => p.value))
