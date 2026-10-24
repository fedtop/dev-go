import { useEffect, useState } from 'react'

import Button from '@/ui/Button'
import Switch from '@/ui/Switch'
import { sendRuntimeMessage } from '@/utils/messaging'
import {
  DEFAULT_NETWORK_RULE_LIST,
  networkRuleList,
  type NetworkRuleListConfig,
} from '@/utils/settings'

import { formatRuleListTime, RECOMMENDED_RULE_LISTS } from './model'

interface RuleListSectionProps {
  /** 规则变化后，若当前代理依赖规则则重新应用 */
  syncProxyIfActive: () => Promise<void>
}

/** 自动模式的 AutoProxy 规则列表：下载 / 更新 / 启停 */
export default function RuleListSection({ syncProxyIfActive }: RuleListSectionProps) {
  const [ruleList, setRuleList] = useState<NetworkRuleListConfig>(DEFAULT_NETWORK_RULE_LIST)
  const [ruleListUrl, setRuleListUrl] = useState('')
  const [ruleListStatus, setRuleListStatus] = useState('')
  const [ruleListError, setRuleListError] = useState(false)
  const [ruleListBusy, setRuleListBusy] = useState(false)

  useEffect(() => {
    let active = true
    networkRuleList.getValue().then((stored) => {
      if (!active) return
      setRuleList(stored)
      setRuleListUrl(stored.url)
    })
    return () => {
      active = false
    }
  }, [])

  const toggleRuleList = async (enabled: boolean) => {
    if (ruleListBusy) return

    if (enabled && !ruleList.text.trim()) {
      setRuleListError(true)
      setRuleListStatus('请先下载规则列表')
      return
    }

    setRuleListBusy(true)
    setRuleListStatus('')
    setRuleListError(false)

    try {
      const nextRuleList = {
        ...ruleList,
        enabled,
        url: ruleListUrl.trim(),
      }
      await networkRuleList.setValue(nextRuleList)
      setRuleList(nextRuleList)
      await syncProxyIfActive()
      setRuleListStatus(enabled ? '规则列表已启用' : '规则列表已停用')
    } catch (error) {
      setRuleListError(true)
      setRuleListStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setRuleListBusy(false)
    }
  }

  const downloadRuleList = async () => {
    if (ruleListBusy) return

    setRuleListBusy(true)
    setRuleListStatus('')
    setRuleListError(false)

    try {
      const result = await sendRuntimeMessage({
        type: 'download-network-rule-list',
        url: ruleListUrl.trim(),
      })

      if (!result.ok) {
        setRuleListError(true)
        setRuleListStatus(result.error || '规则列表下载失败')
        return
      }

      const nextRuleList = await networkRuleList.getValue()
      setRuleList(nextRuleList)
      setRuleListUrl(nextRuleList.url)
      await syncProxyIfActive()
      setRuleListStatus(
        `已更新 ${nextRuleList.proxyRuleCount} 条代理规则，${nextRuleList.directRuleCount} 条直连例外`,
      )
    } catch (error) {
      setRuleListError(true)
      setRuleListStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setRuleListBusy(false)
    }
  }

  const selectRecommendedRuleList = (url: string) => {
    setRuleListUrl(url)
    setRuleListStatus('')
    setRuleListError(false)
  }

  const ruleListTime = formatRuleListTime(ruleList.lastUpdate)

  return (
    <div className='border-t border-slate-100 pt-3'>
      <div className='mb-2 flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <h3 className='text-xs font-semibold text-slate-700'>规则列表</h3>
          <p className='truncate text-[10px] leading-4 text-slate-400'>
            {ruleList.lastUpdate
              ? `${ruleListTime} · ${ruleList.proxyRuleCount} 条代理规则`
              : 'AutoProxy / GFWList'}
          </p>
        </div>
        <Switch checked={ruleList.enabled} onChange={toggleRuleList} disabled={ruleListBusy} />
      </div>

      <div className='flex items-center gap-2'>
        <input
          value={ruleListUrl}
          placeholder='https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt'
          onChange={(event) => setRuleListUrl(event.target.value)}
          className='min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
        />
        <Button onClick={downloadRuleList} loading={ruleListBusy} className='shrink-0'>
          {ruleList.text ? '更新' : '下载'}
        </Button>
      </div>

      <p className='mt-1.5 text-[10px] leading-4 text-slate-400'>
        启用后命中规则走自动代理，未命中规则直连；未启用时自动模式保持全局代理。
      </p>
      <div className='mt-2 flex flex-wrap gap-1.5'>
        {RECOMMENDED_RULE_LISTS.map((item) => (
          <button
            key={item.url}
            type='button'
            title={item.url}
            onClick={() => selectRecommendedRuleList(item.url)}
            className={`rounded border px-2 py-1 text-[10px] leading-4 transition-[transform,border-color,background-color,color] duration-150 ease-out active:translate-y-px active:scale-[0.98] ${
              ruleListUrl === item.url
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {(ruleListStatus || ruleList.directRuleCount > 0) && (
        <p
          className={`mt-1 text-[10px] leading-4 ${
            ruleListError ? 'text-rose-500' : 'text-slate-500'
          }`}
        >
          {ruleListStatus ||
            `包含 ${ruleList.directRuleCount} 条直连例外，最后更新 ${ruleListTime}`}
        </p>
      )}
    </div>
  )
}
