import { useEffect, useState } from 'react'

import Switch from '@/ui/Switch'
import { sendRuntimeMessage } from '@/utils/messaging'
import { enableCorsBypass } from '@/utils/settings'

/** 解除 CORS 限制：为网页 XHR/fetch 响应补充跨域头（DNR 动态规则） */
export default function CorsSection() {
  const [corsOn, setCorsOn] = useState(false)
  const [corsBusy, setCorsBusy] = useState(false)
  const [corsStatus, setCorsStatus] = useState('')

  useEffect(() => {
    let active = true
    enableCorsBypass.getValue().then((enabled) => {
      if (!active) return
      setCorsOn(enabled)
      if (enabled) {
        sendRuntimeMessage({ type: 'sync-cors-bypass' }).catch((error) => {
          console.warn('[DevGo] sync CORS bypass failed:', error)
        })
      }
    })
    return () => {
      active = false
    }
  }, [])

  const toggleCors = async (checked: boolean) => {
    if (corsBusy) return
    setCorsBusy(true)
    setCorsStatus('')

    try {
      if (checked) {
        await enableCorsBypass.setValue(true)
        const active = await sendRuntimeMessage({ type: 'sync-cors-bypass' })
        setCorsOn(active)
        setCorsStatus(active ? '已对网页 XHR/fetch 响应补充 CORS 头' : '规则未生效')
        return
      }

      await enableCorsBypass.setValue(false)
      await sendRuntimeMessage({ type: 'sync-cors-bypass' })
      setCorsOn(false)
      setCorsStatus('已关闭')
    } catch (error) {
      console.warn('[DevGo] toggle CORS bypass failed:', error)
      await enableCorsBypass.setValue(false)
      await sendRuntimeMessage({ type: 'sync-cors-bypass' }).catch(() => false)
      setCorsOn(false)
      setCorsStatus('启用失败，请查看扩展权限或重新加载插件')
    } finally {
      setCorsBusy(false)
    }
  }

  return (
    <section className='rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'>
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <h2 className='text-sm font-semibold text-slate-800'>
            解除 CORS 限制（关闭浏览器“接口跨域”限制）
          </h2>
          <p className='text-xs text-slate-400'>为网页 XHR/fetch 响应补充跨域响应头</p>
        </div>
        <Switch checked={corsOn} onChange={toggleCors} disabled={corsBusy} />
      </div>
      <p className='mt-2 text-[10px] leading-4 text-slate-400'>
        仅用于本地开发调试；无法修复服务器拒绝 OPTIONS、带凭证请求、CSP
        或混合内容限制。开关切换后需刷新页面生效。
      </p>
      {corsStatus && <p className='mt-1 text-[10px] leading-4 text-slate-500'>{corsStatus}</p>}
    </section>
  )
}
