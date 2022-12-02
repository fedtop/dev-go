import { useState } from 'react'

import Footer from '~components/Footer'
import Header from '~components/Header'
import FunctionPage from '~popup/function-page'
import ToolsPage from '~popup/tool-page'
import TranslatePage from '~popup/translation-page'

import 'antd/dist/reset.css'
import '~style/index.css'

const pages = [
  {
    key: 'translate',
    name: '翻译页',
  },
  {
    key: 'tools',
    name: '工具页',
  },
  {
    key: 'function',
    name: '功能页',
  },
]
export default function IndexPopup() {
  const [active, setActive] = useState('translate')
  // const [active, setActive] = useState('tools')

  return (
    <div className='w-[500px] flex flex-col bg-slate-300 p-3'>
      {/* 头部 */}
      <Header active={active} pages={pages} setActive={setActive} />
      <hr />
      {/* 各个标签页 */}
      <div className='my-[10px]'>
        {/* 翻译页 */}
        {active === 'translate' && <TranslatePage />}
        {/* 工具页 */}
        {active === 'tools' && <ToolsPage />}
        {/* 功能页 */}
        {active === 'function' && <FunctionPage />}
      </div>
      <hr />
      {/* 页脚 */}
      <Footer />
    </div>
  )
}
