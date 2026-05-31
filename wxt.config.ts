import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],

  // Vite 配置：注入 Tailwind v4 插件（无需 postcss / tailwind.config）
  vite: () => ({
    plugins: [tailwindcss()],
  }),

  autoIcons: {
    baseIconPath: 'assets/icon.png',
  },

  manifest: ({ mode }) => ({
    name: 'DevGo',
    homepage_url: 'https://github.com/wangrongding',
    permissions: ['contextMenus', 'tabs', 'storage', 'bookmarks'],
    // 翻译接口需要的跨域访问权限
    host_permissions: [
      'https://translate.google.com/*',
      'http://aidemo.youdao.com/*',
      'https://edge.microsoft.com/*',
      'https://api-edge.cognitive.microsofttranslator.com/*',
    ],
    commands: {
      // 打开/切换 popup 面板。Alt 在 Win/Linux 为 Alt，在 Mac 自动映射为 Option(⌥)
      _execute_action: {
        suggested_key: { default: 'Alt+1' },
      },
      // 对当前页面进行行间对比翻译
      'inline-translate': {
        suggested_key: { default: 'Alt+2' },
        description: '对当前页面进行行间对比翻译',
      },
    },
  }),
})
