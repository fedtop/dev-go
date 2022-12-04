import { Switch } from 'antd'
import React from 'react'

const onChange = (checked: boolean) => {
  console.log(`switch to ${checked}`)
}

export default function FunctionPage() {
  return (
    <div className='h-full w-full text-left'>
      <div>
        <label htmlFor='github'>github 快捷在线编辑</label>{' '}
        <Switch id='github' defaultChecked onChange={onChange} />
      </div>
      <h2>功能页，开发中...( Tools page wip...)</h2>
    </div>
  )
}
