import '@/assets/global.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { migrateStorage } from '@/utils/settings'
import App from './App'

const render = () =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

// 先完成存储迁移（旧版 sync 数据搬回本机）再渲染，避免读到空数据；迁移失败也不阻塞渲染。
migrateStorage()
  .catch(() => undefined)
  .finally(render)
