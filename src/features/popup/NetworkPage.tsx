import { useState } from 'react'

import CorsSection from '@/features/network/CorsSection'
import ModeSelector from '@/features/network/ModeSelector'
import { SCHEME_OPTIONS } from '@/features/network/model'
import { useScenarioHostProxy } from '@/features/network/ScenarioRulesSection'
import { useNetworkController } from '@/features/network/useNetworkController'
import Button from '@/ui/Button'
import { ArrowUpRight } from 'lucide-react'

/** 打开设置页「网络代理」分区，并关闭 popup */
function openNetworkSettings() {
  void browser.tabs
    .create({ url: browser.runtime.getURL('/options.html#network') })
    .finally(() => window.close())
}

/**
 * popup「网络」页：只做高频操作 —— 切换网络模式、把当前网站设为直连 / 走代理、CORS 调试开关。
 * 代理服务器、绕过列表、规则列表、自定义模式等完整配置在设置页「网络代理」。
 */
export default function NetworkPage() {
  const c = useNetworkController({ withPageContext: true })
  const hostProxy = useScenarioHostProxy(c.currentHost, c.syncProxyIfActive, () => {
    // 绕过列表优先级更高，站点改为走代理时需移出绕过列表
    if (c.currentHostBypassed) void c.toggleCurrentHostBypass()
  })
  const [hostTip, setHostTip] = useState('')

  const scheme = SCHEME_OPTIONS.find((item) => item.value === c.profile.scheme)?.label
  const tip = hostTip || c.customModeStatus

  return (
    <div className='flex flex-col gap-2.5'>
      <section className='rounded-lg border border-neutral-200 bg-white p-2.5'>
        <div className='mb-2 flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className='text-sm font-semibold text-neutral-800'>网络模式</h2>
            <p className='truncate text-xs text-neutral-500'>
              {c.currentHost ? `当前网页：${c.currentHost}` : '当前网页不可配置代理'}
            </p>
          </div>
          <button
            type='button'
            onClick={openNetworkSettings}
            className='shrink-0 text-xs text-neutral-500 transition-colors hover:text-accent-600'
          >
            代理设置
            <ArrowUpRight className='ml-0.5 inline size-3 -translate-y-px' aria-hidden />
          </button>
        </div>

        <ModeSelector
          mode={c.mode}
          customModes={c.customProxyModes}
          activeCustomModeId={c.activeCustomProxyModeId}
          customModeActive={Boolean(c.activeCustomProxyMode)}
          disabled={c.busy}
          onSelectMode={c.applyMode}
          onSelectCustomMode={c.selectCustomProxyMode}
        />

        {c.statusText && (
          <p
            className={`mt-2 text-[10px] leading-4 ${
              c.status?.ok ? 'text-neutral-500' : 'text-rose-500'
            }`}
          >
            {c.statusText}
          </p>
        )}
      </section>

      {c.showProxySettings && (
        <section className='flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-2.5'>
          <button
            type='button'
            onClick={openNetworkSettings}
            title='在设置页编辑代理服务器与规则'
            className='group flex items-center justify-between gap-2 text-left'
          >
            <span className='min-w-0'>
              <span className='block truncate text-xs text-neutral-500'>
                {c.proxyConfigDescription}
              </span>
              <span className='block truncate font-mono text-xs text-neutral-700'>
                {scheme} {c.profile.host}:{c.profile.port}
                <span className='ml-2 font-sans text-neutral-500'>
                  绕过 {c.bypassList.length} 条
                </span>
              </span>
            </span>
            <span className='shrink-0 text-xs text-neutral-500 group-hover:text-accent-600'>
              编辑
              <ArrowUpRight className='ml-0.5 inline size-3 -translate-y-px' aria-hidden />
            </span>
          </button>

          {c.currentHost && (
            <div className='flex flex-wrap gap-1.5 border-t border-neutral-100 pt-2'>
              <Button
                disabled={c.busy}
                onClick={() => {
                  setHostTip('')
                  void c.toggleCurrentHostBypass()
                }}
                className='!px-2 !py-1 text-xs'
              >
                {c.currentHostBypassed ? '取消当前站点直连' : '当前站点直连'}
              </Button>
              {c.showRuleListSettings && (
                <Button
                  disabled={c.busy}
                  onClick={() => void hostProxy.toggle().then(setHostTip)}
                  className='!px-2 !py-1 text-xs'
                >
                  {hostProxy.proxied ? '取消当前站点走代理' : '当前站点走代理'}
                </Button>
              )}
            </div>
          )}

          {tip && (
            <p
              className={`text-[10px] leading-4 ${
                c.customModeError && !hostTip ? 'text-rose-500' : 'text-neutral-500'
              }`}
            >
              {tip}
            </p>
          )}
        </section>
      )}

      <CorsSection />
    </div>
  )
}
