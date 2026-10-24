import Button from '@/ui/Button'
import type { NetworkProxyProfile } from '@/utils/settings'

import { CUSTOM_PROXY_MODE_NAME_MAX } from './model'
import ProxyServerFields, { INPUT_CLASS } from './ProxyServerFields'

interface CustomModeDialogProps {
  name: string
  profile: NetworkProxyProfile
  status: string
  error: boolean
  busy: boolean
  onNameChange: (name: string) => void
  onProfileChange: (update: (profile: NetworkProxyProfile) => NetworkProxyProfile) => void
  onClose: () => void
  onSave: () => void
}

/** 新增自定义代理模式 */
export default function CustomModeDialog({
  name,
  profile,
  status,
  error,
  busy,
  onNameChange,
  onProfileChange,
  onClose,
  onSave,
}: CustomModeDialogProps) {
  return (
    <div
      className='fixed inset-0 z-40 flex items-center justify-center bg-slate-950/20 p-3 backdrop-blur-sm'
      onClick={onClose}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-label='新增自定义代理模式'
        className='w-full max-w-[340px] rounded-xl border border-slate-200 bg-white p-3 shadow-[0_18px_60px_rgba(15,23,42,0.28)]'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-3 flex items-center justify-between gap-3'>
          <h3 className='text-sm font-semibold text-slate-800'>新增自定义代理</h3>
          <button
            type='button'
            disabled={busy}
            onClick={onClose}
            className='flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-[transform,border-color,color] duration-150 ease-out hover:border-slate-300 hover:text-slate-600 enabled:active:translate-y-px enabled:active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-50'
            aria-label='关闭'
          >
            ×
          </button>
        </div>

        <div className='flex flex-col gap-2.5'>
          <label className='flex flex-col gap-1'>
            <span className='text-[11px] font-medium text-slate-500'>名称</span>
            <input
              autoFocus
              value={name}
              maxLength={CUSTOM_PROXY_MODE_NAME_MAX}
              placeholder='代理名称'
              onChange={(event) => onNameChange(event.target.value)}
              className={INPUT_CLASS}
            />
          </label>

          <ProxyServerFields labeled profile={profile} onChange={onProfileChange} />
        </div>

        {status && (
          <p className={`mt-2 text-[10px] leading-4 ${error ? 'text-rose-500' : 'text-slate-500'}`}>
            {status}
          </p>
        )}

        <div className='mt-3 flex justify-end gap-2'>
          <Button onClick={onClose} disabled={busy} className='!px-2.5 text-xs'>
            取消
          </Button>
          <Button variant='primary' onClick={onSave} loading={busy} className='!px-2.5 text-xs'>
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}
