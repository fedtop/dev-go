import { useEffect, useRef, useState } from 'react'

import { POPUP_PAGES } from '@/features/popup/pages'
import Button from '@/ui/Button'
import Select from '@/ui/Select'
import { buildBackup, restoreBackup } from '@/utils/backup'
import { sendRuntimeMessage } from '@/utils/messaging'
import { defaultPopupTab, syncStatus } from '@/utils/settings'
import { formatShortcut } from '@/utils/shortcut'
import { useStorageItem } from '@/utils/useStorageItem'

import { Card, Row, SectionHeader } from './layout'

/** 命令 name -> 展示名（按声明顺序展示） */
const COMMAND_LABELS: Record<string, string> = {
  'open-default': '打开弹窗（默认页）',
  'open-assistant': '打开 AI 助手（侧边栏）',
  'open-network': '打开弹窗「网络」页',
  'open-tools': '打开弹窗「资源」页',
  'inline-translate': '整页行间翻译',
}

/** chrome.storage.sync 总配额 */
const SYNC_QUOTA_BYTES = 102_400

function formatSyncTime(timestamp: number): string {
  const date = new Date(timestamp)
  const sameDay = date.toDateString() === new Date().toDateString()
  return sameDay
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

function ShortcutsCard() {
  const [shortcuts, setShortcuts] = useState<Array<{ name: string; shortcut: string }>>([])

  useEffect(() => {
    void browser.commands?.getAll().then((commands) => {
      const byName = new Map(commands.map((command) => [command.name, command.shortcut ?? '']))
      setShortcuts(
        Object.keys(COMMAND_LABELS)
          .filter((name) => byName.has(name))
          .map((name) => ({ name, shortcut: byName.get(name) ?? '' })),
      )
    })
  }, [])

  return (
    <Card
      title='快捷键'
      desc='浏览器不允许扩展自行修改快捷键，需要在扩展快捷键设置页里自定义。'
      extra={
        // Chrome 命令快捷键只能在系统设置页修改
        <Button
          onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
          className='!px-2.5 !py-1 text-xs'
        >
          自定义 ↗
        </Button>
      }
    >
      <div className='flex flex-col gap-2'>
        {shortcuts.map((item) => (
          <div key={item.name} className='flex items-center justify-between text-sm'>
            <span className='text-slate-600'>{COMMAND_LABELS[item.name]}</span>
            {item.shortcut ? (
              <kbd className='rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600'>
                {formatShortcut(item.shortcut)}
              </kbd>
            ) : (
              <span className='text-xs text-slate-400'>未设置</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** 跨设备同步：同步范围说明 + 状态 + 手动同步 */
function SyncCard() {
  const [status] = useStorageItem(syncStatus)
  const [running, setRunning] = useState(false)

  const syncing = running || status.state === 'syncing'
  const usage =
    status.bytesInUse !== undefined
      ? `已用 ${(status.bytesInUse / 1024).toFixed(1)}KB / ${SYNC_QUOTA_BYTES / 1024}KB`
      : ''

  let summary = '尚未同步'
  if (syncing) summary = '同步中…'
  else if (status.state === 'error') summary = status.message || '同步失败'
  else if (status.lastSyncedAt) summary = `上次同步 ${formatSyncTime(status.lastSyncedAt)}`

  const syncNow = async () => {
    setRunning(true)
    try {
      await sendRuntimeMessage({ type: 'sync-now' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card
      title='跨设备同步'
      desc='快捷导航、代理配置随浏览器账号自动同步到其他设备。'
      extra={
        <Button onClick={() => void syncNow()} disabled={syncing} className='!px-2.5 !py-1 text-xs'>
          立即同步
        </Button>
      }
    >
      <div className='flex items-center justify-between gap-2 text-sm'>
        <span
          className={`truncate ${
            status.state === 'error' && !syncing ? 'text-rose-500' : 'text-slate-600'
          }`}
        >
          {summary}
        </span>
        {usage && <span className='shrink-0 text-xs text-slate-400'>{usage}</span>}
      </div>
    </Card>
  )
}

function BackupCard() {
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 导出全部配置（含快捷导航、网络配置等）为 JSON 文件
  const exportBackup = async () => {
    try {
      const backup = await buildBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `devgo-backup-${backup.exportedAt.slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setMessage('已导出')
    } catch {
      setMessage('导出失败')
    }
  }

  const importBackup = async (file: File) => {
    try {
      const { imported, skipped } = await restoreBackup(await file.text())
      setMessage(
        skipped.length > 0
          ? `已导入 ${imported} 项（跳过 ${skipped.length} 项无效数据）`
          : `已导入 ${imported} 项，立即生效`,
      )
    } catch (error) {
      setMessage(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <Card
      title='数据备份'
      desc='导出 / 导入全部配置（快捷导航、网络、翻译、AI 模型等）。API Key 不会写入备份文件。'
    >
      <div className='flex items-center gap-2'>
        <Button onClick={() => void exportBackup()}>导出配置</Button>
        <Button onClick={() => fileInputRef.current?.click()}>导入配置</Button>
        {message && <span className='ml-2 text-xs text-slate-500'>{message}</span>}
      </div>
      <input
        ref={fileInputRef}
        type='file'
        accept='.json,application/json'
        className='hidden'
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importBackup(file)
          // 清空选择，同一文件可重复导入
          event.target.value = ''
        }}
      />
    </Card>
  )
}

/** 设置页：通用 */
export default function GeneralSettings() {
  const [defaultTab, setDefaultTab] = useStorageItem(defaultPopupTab)

  return (
    <div className='flex flex-col gap-5'>
      <SectionHeader title='通用' desc='弹窗、快捷键、同步与备份' />

      <Card title='弹窗'>
        <Row label='默认打开的页' hint='点击工具栏图标或按快捷键打开弹窗时定位的页面'>
          <Select
            value={defaultTab}
            options={POPUP_PAGES}
            onChange={setDefaultTab}
            className='w-32'
          />
        </Row>
      </Card>

      <ShortcutsCard />
      <SyncCard />
      <BackupCard />
    </div>
  )
}
