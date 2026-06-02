import ReactDOM from 'react-dom/client'

import SelectionApp from '@/features/selection/SelectionApp'
import {
  getLocalBooleanSetting,
  hasExtensionRuntime,
  watchLocalBooleanSetting,
} from '@/utils/content-settings'
import '@/features/selection/style.css'

const ENABLE_SELECTION_TRANSLATE_KEY = 'enableSelectionTranslate'

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    if (!hasExtensionRuntime()) return

    const ui = await createShadowRootUi(ctx, {
      name: 'devgo-selection-ui',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        // 渲染到独立子节点，避免 React 直接挂载到 body 容器的告警
        const app = document.createElement('div')
        container.append(app)
        const root = ReactDOM.createRoot(app)
        root.render(<SelectionApp />)
        return root
      },
      onRemove(root) {
        root?.unmount()
      },
    })

    // 按开关挂载 / 卸载，并监听设置变化动态启停
    const applyEnabled = (enabled: boolean) => {
      if (enabled) ui.mount()
      else ui.remove()
    }
    const sync = async () => {
      applyEnabled(await getLocalBooleanSetting(ENABLE_SELECTION_TRANSLATE_KEY, true))
    }

    await sync()
    const unwatch = watchLocalBooleanSetting(ENABLE_SELECTION_TRANSLATE_KEY, true, applyEnabled)
    ctx.onInvalidated(unwatch)
  },
})
