import { useEffect, useState } from 'react'

import { defaultPopupTab, enableGithubEnhance, enableSelectionTranslate } from '@/utils/settings'
import { formatShortcut } from '@/utils/shortcut'
import { POPUP_PAGES } from '@/features/popup/pages'
import Button from '@/ui/Button'
import Select from '@/ui/Select'
import Switch from '@/ui/Switch'

// 命令 name -> 展示名
const COMMAND_LABELS: Record<string, string> = {
  _execute_action: '打开面板',
  'open-todo': '打开待办面板',
  'open-network': '打开网络面板',
  'open-tools': '打开资源面板',
  'inline-translate': '整页行间翻译',
}

interface ShortcutItem {
  name: string
  label: string
  shortcut: string
}

export default function FunctionPage() {
  const [selectionOn, setSelectionOn] = useState(true)
  const [githubOn, setGithubOn] = useState(true)
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([])
  const [defaultTab, setDefaultTab] = useState('translate')

  useEffect(() => {
    enableSelectionTranslate.getValue().then(setSelectionOn)
    enableGithubEnhance.getValue().then(setGithubOn)
    defaultPopupTab.getValue().then(setDefaultTab)

    // 读取当前已注册的命令快捷键（按 COMMAND_LABELS 的声明顺序展示）
    browser.commands?.getAll().then((cmds) => {
      const byName = new Map(cmds.map((c) => [c.name, c]))
      setShortcuts(
        Object.keys(COMMAND_LABELS)
          .filter((name) => byName.has(name))
          .map((name) => ({
            name,
            label: COMMAND_LABELS[name],
            shortcut: byName.get(name)!.shortcut || '',
          })),
      )
    })
  }, [])

  const changeDefaultTab = (value: string) => {
    setDefaultTab(value)
    defaultPopupTab.setValue(value)
  }

  const toggleSelection = (checked: boolean) => {
    setSelectionOn(checked)
    enableSelectionTranslate.setValue(checked)
  }

  const toggleGithub = (checked: boolean) => {
    setGithubOn(checked)
    enableGithubEnhance.setValue(checked)
  }

  // Chrome 命令快捷键无法用代码修改，只能跳转到系统设置页让用户自定义
  const openShortcutsPage = () => {
    browser.tabs.create({ url: 'chrome://extensions/shortcuts' })
  }

  return (
    <div className='flex flex-col gap-2.5'>
      <div className='flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm'>
        <div className='flex flex-col'>
          <span className='text-sm font-medium text-slate-800'>默认打开 Tab</span>
          <span className='text-xs text-slate-400'>Alt+1 打开面板时定位的页面</span>
        </div>
        <Select
          value={defaultTab}
          options={POPUP_PAGES}
          onChange={changeDefaultTab}
          className='w-24'
        />
      </div>

      <div className='flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm'>
        <div className='flex flex-col'>
          <span className='text-sm font-medium text-slate-800'>划词翻译</span>
          <span className='text-xs text-slate-400'>选中文本后显示翻译按钮</span>
        </div>
        <Switch checked={selectionOn} onChange={toggleSelection} />
      </div>

      <div className='flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm'>
        <div className='flex flex-col'>
          <span className='text-sm font-medium text-slate-800'>GitHub 快捷在线编辑</span>
          <span className='text-xs text-slate-400'>代码页快捷键 , 打开 github1s</span>
        </div>
        <Switch checked={githubOn} onChange={toggleGithub} />
      </div>

      {/* 快捷键 */}
      <div className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm'>
        <div className='mb-2 flex items-center justify-between'>
          <span className='text-sm font-medium text-slate-800'>快捷键</span>
          <Button onClick={openShortcutsPage} className='!px-2 !py-1 text-xs'>
            自定义 ↗
          </Button>
        </div>
        <div className='flex flex-col gap-1.5'>
          {shortcuts.map((s) => (
            <div key={s.name} className='flex items-center justify-between text-xs'>
              <span className='text-slate-500'>{s.label}</span>
              {s.shortcut ? (
                <kbd className='rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600'>
                  {formatShortcut(s.shortcut)}
                </kbd>
              ) : (
                <span className='text-[10px] text-slate-400'>未设置</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
