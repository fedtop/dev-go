import Button from '@/ui/Button'

interface DeleteModeDialogProps {
  name: string
  /** 删除失败的原因 */
  error: string
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}

/** 删除自定义代理模式的确认框 */
export default function DeleteModeDialog({
  name,
  error,
  busy,
  onClose,
  onConfirm,
}: DeleteModeDialogProps) {
  return (
    <div
      className='fixed inset-0 z-40 flex items-center justify-center bg-slate-950/20 p-3 backdrop-blur-sm'
      onClick={onClose}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-label='删除自定义代理模式'
        className='w-full max-w-[340px] rounded-xl border border-rose-100 bg-white p-3 shadow-[0_18px_60px_rgba(127,29,29,0.18)]'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex items-start gap-3'>
          <div className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-sm font-semibold text-rose-600'>
            !
          </div>
          <div className='min-w-0'>
            <h3 className='text-sm font-semibold text-slate-800'>删除自定义代理</h3>
            <p className='mt-1 truncate text-xs font-medium text-slate-700'>「{name}」</p>
            <p className='mt-1 text-xs leading-5 text-slate-500'>
              删除后会回到内置代理配置，不影响自动模式、代理模式和其他自定义模式。
            </p>
          </div>
        </div>

        {error && (
          <p className='mt-2 rounded-lg border border-rose-100 bg-rose-50/70 px-2.5 py-2 text-[10px] leading-4 text-rose-600'>
            {error}
          </p>
        )}

        <div className='mt-3 flex justify-end gap-2'>
          <Button onClick={onClose} disabled={busy} className='!px-2.5 text-xs'>
            取消
          </Button>
          <button
            type='button'
            disabled={busy}
            onClick={onConfirm}
            className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_6px_16px_rgba(225,29,72,0.18)] transition-[transform,border-color,background-color,box-shadow,filter] duration-150 ease-out hover:bg-rose-500 hover:shadow-[0_8px_20px_rgba(225,29,72,0.24)] enabled:active:translate-y-px enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
          >
            {busy && (
              <span
                className='h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white'
                aria-hidden='true'
              />
            )}
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
