import { useState } from 'react'

import Button from '@/ui/Button'
import Switch from '@/ui/Switch'
import { enableGithubEnhance, unlockHosts } from '@/utils/settings'
import { useStorageItem } from '@/utils/useStorageItem'

import { Card, INPUT_CLASS, Row, SectionHeader } from './layout'
import { X } from 'lucide-react'

/** 设置页：网页增强 */
export default function EnhanceSettings() {
  const [githubOn, setGithubOn] = useStorageItem(enableGithubEnhance)
  const [hosts, setHosts] = useStorageItem(unlockHosts)
  const [input, setInput] = useState('')

  const add = () => {
    const raw = input.trim()
    if (!raw) return
    try {
      const host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname
      setHosts([...new Set([...hosts, host])])
      setInput('')
    } catch {
      // 无法解析的输入不添加
    }
  }

  return (
    <div className='flex flex-col gap-5'>
      <SectionHeader title='网页增强' desc='GitHub 增强与按站点解除复制限制' />

      <Card title='GitHub'>
        <Row
          label='GitHub 增强'
          hint='代码页悬浮按钮（在线编辑、DeepWiki、回到顶部），快捷键 , 打开 github1s'
        >
          <Switch checked={githubOn} onChange={setGithubOn} />
        </Row>
      </Card>

      <Card
        title='解除复制限制的网站'
        desc='放开这些网站的复制、选择与右键限制。只对列表里的网站生效（全局放开会让在线编辑器等网站失灵），也可以在弹窗「功能」页一键开关当前网站。'
      >
        <div className='flex gap-2'>
          <input
            className={INPUT_CLASS}
            value={input}
            placeholder='例如 www.example.com'
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
          />
          <Button onClick={add} className='shrink-0'>
            添加
          </Button>
        </div>
        {hosts.length > 0 ? (
          <ul className='flex flex-wrap gap-2'>
            {hosts.map((host) => (
              <li
                key={host}
                className='flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 py-1 pr-1.5 pl-3 text-xs text-neutral-600'
              >
                {host}
                <button
                  type='button'
                  aria-label={`移除 ${host}`}
                  onClick={() => setHosts(hosts.filter((item) => item !== host))}
                  className='flex h-4 w-4 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200 hover:text-neutral-600'
                >
                  <X className='size-3' aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-xs text-neutral-500'>暂无</p>
        )}
      </Card>
    </div>
  )
}
