import '@/assets/global.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import AssistantApp from '@/features/assistant/AssistantApp'

document.documentElement.classList.add('sidepanel-page')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AssistantApp />
  </React.StrictMode>,
)
