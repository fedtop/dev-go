import type { NetworkCustomProxyModeProfile, NetworkMode } from '@/utils/settings'

import { Globe, MonitorCog, Plug, Route, Waypoints, type LucideIcon } from 'lucide-react'

import { MODE_OPTIONS } from './model'

const MODE_ICONS: Record<NetworkMode, LucideIcon> = {
  direct: Plug,
  system: MonitorCog,
  scenario: Route,
  global: Globe,
}

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
          const Icon = MODE_ICONS[item.value]
          return (
            <button
              key={item.value}
              type='button'
              disabled={disabled}
              onClick={() => onSelectMode(item.value)}
              title={item.description}
              className={`flex h-[52px] w-[84px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 text-center transition-[transform,border-color,background-color,color] duration-150 ease-out enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-neutral-900 bg-white text-neutral-900 shadow-[0_0_0_1px_var(--color-neutral-900)]'
                  : 'border-black/10 bg-white text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900'
              }`}
            >
              <span className='flex items-center gap-1 text-xs font-medium'>
                <Icon className='size-3.5' strokeWidth={1.8} aria-hidden />
                {item.label}
              </span>
              <span className='block max-w-full truncate text-[10px] leading-3 text-neutral-500'>
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
              className={`flex h-[52px] w-[92px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 text-center transition-[transform,border-color,background-color,color] duration-150 ease-out enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-neutral-900 bg-white text-neutral-900 shadow-[0_0_0_1px_var(--color-neutral-900)]'
                  : 'border-black/10 bg-white text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900'
              }`}
            >
              <span className='flex max-w-full items-center gap-1 text-xs font-medium'>
                <Waypoints className='size-3.5 shrink-0' strokeWidth={1.8} aria-hidden />
                <span className='truncate'>{item.name}</span>
              </span>
              <span className='block max-w-full truncate text-[10px] leading-3 text-neutral-500'>
                自定义代理
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
