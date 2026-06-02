import ReactDOM from 'react-dom/client'

import GithubApp from '@/features/github/GithubApp'
import {
  getLocalBooleanSetting,
  hasExtensionRuntime,
  watchLocalBooleanSetting,
} from '@/utils/content-settings'
import '@/features/github/style.css'

const ENABLE_GITHUB_ENHANCE_KEY = 'enableGithubEnhance'

export default defineContentScript({
  matches: ['https://github.com/*'],
  // Shadow DOM 隔离样式，避免污染 GitHub 页面
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    if (!hasExtensionRuntime()) return

    const ui = await createShadowRootUi(ctx, {
      name: 'devgo-github-ui',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        // 渲染到独立子节点，避免 React 直接挂载到 body 容器的告警
        const app = document.createElement('div')
        container.append(app)
        const root = ReactDOM.createRoot(app)
        root.render(<GithubApp />)
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
      applyEnabled(await getLocalBooleanSetting(ENABLE_GITHUB_ENHANCE_KEY, true))
    }

    await sync()
    const unwatch = watchLocalBooleanSetting(ENABLE_GITHUB_ENHANCE_KEY, true, applyEnabled)
    ctx.onInvalidated(unwatch)
  },
})
