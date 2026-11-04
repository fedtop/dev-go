import '@/assets/global.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { initDocumentTheme } from '@/utils/theme'

import App from './App'

void initDocumentTheme()
  .catch(() => undefined)
  .finally(() =>
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  )
