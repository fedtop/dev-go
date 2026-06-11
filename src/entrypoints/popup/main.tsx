import '@/assets/global.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { migrateLocalToSync } from '@/utils/settings'
import App from './App'

document.documentElement.classList.add('popup-page')

const render = () =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

// 先把旧 local 数据迁移到 sync，再渲染，避免读到空数据；迁移失败也不阻塞渲染。
migrateLocalToSync()
  .catch(() => undefined)
  .finally(render)
