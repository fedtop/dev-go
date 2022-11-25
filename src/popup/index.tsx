import { Radio } from 'antd'
import { useEffect, useState } from 'react'

import Footer from '~components/Footer'
import Header from '~components/Header'

import ToolsPage from './tools'
import TranslatePage from './translate'

import '~style/index.css'

function IndexPopup() {
  const [active, setActive] = useState('translate')

  return (
    <div className='w-[500px] text-center flex flex-col bg-slate-300 p-3'>
      {/* 头部 */}
      <Header active={active} setActive={setActive} />
      <hr />
      {/* 各个标签页 */}
      {active === 'translate' && <TranslatePage />}
      {active === 'tools' && <ToolsPage />}

      {/* 页脚 */}
      <Footer />
    </div>
  )
}

export default IndexPopup
