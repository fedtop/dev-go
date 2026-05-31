import ReactDOM from 'react-dom/client'

import SelectionApp from '@/features/selection/SelectionApp'
import { enableSelectionTranslate } from '@/utils/settings'
import '@/features/selection/style.css'

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
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
    const sync = async () => {
      const enabled = await enableSelectionTranslate.getValue()
      if (enabled) ui.mount()
      else ui.remove()
    }

    await sync()
    const unwatch = enableSelectionTranslate.watch(sync)
    ctx.onInvalidated(unwatch)
  },
})
