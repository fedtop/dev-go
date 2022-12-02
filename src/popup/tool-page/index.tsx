import { Switch } from 'antd'
import React from 'react'

const onChange = (checked: boolean) => {
  console.log(`switch to ${checked}`)
}

export default function ToolsPage() {
  return (
    <div className='w-full text-left h-full'>
      <div>摘录本页连接到 MarkDown</div>
      <h2>工具页，开发中...( Tools page wip...)</h2>
    </div>
  )
}
