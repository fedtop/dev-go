import type { NetworkCustomProxyModeProfile, NetworkMode } from '@/utils/settings'

import { MODE_OPTIONS } from './model'

interface ModeSelectorProps {
  mode: NetworkMode
  customModes: NetworkCustomProxyModeProfile[]
  activeCustomModeId: string
  /** 当前是否处于某个自定义模式（此时内置「代理模式」不高亮） */
  customModeActive: boolean
  disabled: boolean
  onSelectMode: (mode: NetworkMode) => void
  onSelectCustomMode: (mode: NetworkCustomProxyModeProfile) => void
}

/** 网络模式按钮组：内置模式 + 用户自定义代理模式，横向滚动 */
export default function ModeSelector({
  mode,
  customModes,
  activeCustomModeId,
  customModeActive,
  disabled,
  onSelectMode,
  onSelectCustomMode,
}: ModeSelectorProps) {
  return (
    <div className='popup-mode-scroll -mx-1 overflow-x-auto px-1'>
      <div className='flex w-max gap-1.5 pb-1'>
        {MODE_OPTIONS.map((item) => {
          const selected = mode === item.value && !(item.value === 'global' && customModeActive)
          return (
            <button
              key={item.value}
              type='button'
              disabled={disabled}
              onClick={() => onSelectMode(item.value)}
              title={item.description}
              className={`h-11 w-[76px] shrink-0 rounded-lg border px-1.5 py-1 text-center transition-[transform,border-color,background-color,color,box-shadow] duration-150 ease-out enabled:active:translate-y-px enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
              }`}
            >
              <span className='block truncate text-xs font-medium'>{item.label}</span>
              <span className='mt-0.5 block truncate text-[9px] leading-3 text-slate-400'>
                {item.description}
              </span>
            </button>
          )
        })}
        {customModes.map((item) => {
          const selected = mode === 'global' && activeCustomModeId === item.id
          return (
            <button
              key={item.id}
              type='button'
              disabled={disabled}
              onClick={() => onSelectCustomMode(item)}
              title={item.name}
              className={`h-11 w-[86px] shrink-0 rounded-lg border px-1.5 py-1 text-center transition-[transform,border-color,background-color,color,box-shadow] duration-150 ease-out enabled:active:translate-y-px enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
              }`}
            >
              <span className='block truncate text-xs font-medium'>{item.name}</span>
              <span className='mt-0.5 block truncate text-[9px] leading-3 text-slate-400'>
                自定义代理
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
