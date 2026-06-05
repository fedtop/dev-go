import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

const DEV_EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn/zYjShBjRda8+YmfcuQprWHUoHe8mUQ/wnF8tr4BI4qiYexNaiMKQ/qHQ9WucT1GOy9OgOxErwOcuq6rvMAAMQD7C/4sgkTXnh6T9qlWfLQ0Dsinn99JUlWbcfvmyZ4Mz5Z6/CK5BsPHKuDzUJbo4G5W7ujSIaHXxyf3lDd9wee7/4Kvo7yv35yQtrROTZXOtTWH3SJbL6DF7cv2AoASEhArj0pUiX3H0sDUQfyDnNi1RBwRm2nICqs/3PqX+QuQGiOZjUzmET5eq1higFx7YwtYLvvZBBdZo64E6CCZJs9368xPoPbK5fGFK5zXSpI9sPQSzIFNR7AW100v0VODQIDAQAB'

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  dev: {
    server: {
      port: 3000,
    },
  },
  webExt: {
    disabled: true,
  },

  // Vite 配置：注入 Tailwind v4 插件（无需 postcss / tailwind.config）
  vite: () => ({
    plugins: [tailwindcss()],
  }),

  autoIcons: {
    baseIconPath: 'assets/icon.png',
  },

  manifest: ({ mode }) => ({
    ...(mode === 'development' ? { key: DEV_EXTENSION_KEY } : {}),
    name: 'DevGo',
    homepage_url: 'https://github.com/wangrongding',
    permissions: [
      'contextMenus',
      'tabs',
      'storage',
      'bookmarks',
      'declarativeNetRequest',
      'proxy',
      'webRequest',
      'downloads',
    ],
    // 内容脚本、CORS 动态规则和后台代理都需要全站访问能力。
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['cors-proxy.js'],
        matches: ['<all_urls>'],
      },
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
      // 打开 popup 并定位到「待办」Tab
      'open-todo': {
        suggested_key: { default: 'Alt+3' },
        description: '打开待办面板',
      },
    },
  }),
})
