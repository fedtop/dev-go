import { useEffect, useMemo, useState } from 'react'

import { getUrlHostname, isValidNetworkProxyProfile, normalizeBypassList } from '@/utils/network'
import { sendRuntimeMessage, type NetworkProxyStatus } from '@/utils/messaging'
import {
  DEFAULT_NETWORK_PROXY_PROFILE,
  DEFAULT_NETWORK_RULE_LIST,
  networkMode,
  networkProxyProfile,
  networkRuleList,
  type NetworkMode,
  type NetworkProxyProfile,
  type NetworkProxyScheme,
  type NetworkRuleListConfig,
} from '@/utils/settings'
import Button from '@/ui/Button'
import Select from '@/ui/Select'
import Switch from '@/ui/Switch'

const MODE_OPTIONS: Array<{ value: NetworkMode; label: string; description: string }> = [
  { value: 'direct', label: '直连', description: '不使用代理' },
  { value: 'system', label: '系统代理', description: '跟随系统设置' },
  { value: 'scenario', label: '情境模式', description: '使用下方代理' },
]

const SCHEME_OPTIONS: Array<{ value: NetworkProxyScheme; label: string }> = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks4', label: 'SOCKS4' },
  { value: 'socks5', label: 'SOCKS5' },
]

const CONTROL_LABELS: Record<string, string> = {
  not_controllable: '浏览器不允许扩展控制代理',
  controlled_by_other_extensions: '代理已被其他扩展控制',
  controllable_by_this_extension: '可由 DevGo 控制',
  controlled_by_this_extension: '已由 DevGo 控制',
}

const RECOMMENDED_RULE_LISTS = [
  {
    label: '规则 1 · GitHub',
    url: 'https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt',
  },
  {
    label: '规则 2 · GitLab',
    url: 'https://gitlab.com/gfwlist/gfwlist/raw/master/gfwlist.txt',
  },
  {
    label: '规则 3 · jsDelivr',
    url: 'https://cdn.jsdelivr.net/gh/gfwlist/gfwlist@master/gfwlist.txt',
  },
  {
    label: '规则 4 · Pagure',
    url: 'https://pagure.io/gfwlist/raw/master/f/gfwlist.txt',
  },
]

function normalizeProfileFromForm(
  profile: NetworkProxyProfile,
  bypassText: string,
): NetworkProxyProfile {
  return {
    ...profile,
    host: profile.host.trim(),
    port: Number.isFinite(profile.port) ? Math.trunc(profile.port) : 0,
    bypassList: normalizeBypassList(bypassText),
  }
}

function getStatusText(status: NetworkProxyStatus | null): string {
  if (!status) return ''
  if (!status.ok) return status.error || '代理设置失败'
  return status.levelOfControl ? CONTROL_LABELS[status.levelOfControl] : '代理设置已同步'
}

function formatRuleListTime(value: string): string {
  if (!value) return ''

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

export default function NetworkPage() {
  const [mode, setMode] = useState<NetworkMode>('system')
  const [appliedMode, setAppliedMode] = useState<NetworkMode>('system')
  const [profile, setProfile] = useState<NetworkProxyProfile>(DEFAULT_NETWORK_PROXY_PROFILE)
  const [bypassText, setBypassText] = useState(DEFAULT_NETWORK_PROXY_PROFILE.bypassList.join('\n'))
  const [ruleList, setRuleList] = useState<NetworkRuleListConfig>(DEFAULT_NETWORK_RULE_LIST)
  const [ruleListUrl, setRuleListUrl] = useState('')
  const [ruleListStatus, setRuleListStatus] = useState('')
  const [ruleListError, setRuleListError] = useState(false)
  const [currentHost, setCurrentHost] = useState('')
  const [status, setStatus] = useState<NetworkProxyStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [ruleListBusy, setRuleListBusy] = useState(false)

  const bypassList = useMemo(() => normalizeBypassList(bypassText), [bypassText])
  const currentHostBypassed = Boolean(currentHost && bypassList.includes(currentHost))

  useEffect(() => {
    let active = true

    Promise.all([
      networkMode.getValue(),
      networkProxyProfile.getValue(),
      networkRuleList.getValue(),
      sendRuntimeMessage({ type: 'get-network-status' }).catch(() => null),
      browser.tabs.query({ active: true, currentWindow: true }),
    ]).then(([storedMode, storedProfile, storedRuleList, networkStatus, tabs]) => {
      if (!active) return

      setMode(storedMode)
      setAppliedMode(storedMode)
      setProfile(storedProfile)
      setBypassText(storedProfile.bypassList.join('\n'))
      setRuleList(storedRuleList)
      setRuleListUrl(storedRuleList.url)
      setStatus(networkStatus)
      setCurrentHost(getUrlHostname(tabs[0]?.url))
    })

    return () => {
      active = false
    }
  }, [])

  const persistScenarioProfile = async (): Promise<NetworkProxyProfile | null> => {
    const nextProfile = normalizeProfileFromForm(profile, bypassText)

    if (!isValidNetworkProxyProfile(nextProfile)) {
      setStatus({
        ok: false,
        mode,
        managed: true,
        error: '请填写有效的代理主机和端口',
      })
      return null
    }

    await networkProxyProfile.setValue(nextProfile)
    setProfile(nextProfile)
    setBypassText(nextProfile.bypassList.join('\n'))
    return nextProfile
  }

  const applyMode = async (nextMode: NetworkMode) => {
    if (busy) return
    setMode(nextMode)
    setBusy(true)

    try {
      if (nextMode === 'scenario') {
        const saved = await persistScenarioProfile()
        if (!saved) return
      }

      const nextStatus = await sendRuntimeMessage({ type: 'apply-network-mode', mode: nextMode })
      setMode(nextStatus.mode)
      setAppliedMode(nextStatus.mode)
      setStatus(nextStatus)
    } catch (error) {
      setStatus({
        ok: false,
        mode: nextMode,
        managed: true,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }

  const saveScenarioProfile = async () => {
    if (busy) return
    setBusy(true)

    try {
      const saved = await persistScenarioProfile()
      if (!saved) return

      if (appliedMode === 'scenario') {
        const nextStatus = await sendRuntimeMessage({ type: 'sync-network-proxy' })
        setAppliedMode(nextStatus.mode)
        setStatus(nextStatus)
        return
      }

      if (mode === 'scenario') {
        const nextStatus = await sendRuntimeMessage({
          type: 'apply-network-mode',
          mode: 'scenario',
        })
        setMode(nextStatus.mode)
        setAppliedMode(nextStatus.mode)
        setStatus(nextStatus)
        return
      }

      setStatus(await sendRuntimeMessage({ type: 'get-network-status' }))
    } catch (error) {
      setStatus({
        ok: false,
        mode,
        managed: true,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }

  const toggleCurrentHostBypass = async () => {
    if (!currentHost || busy) return
    setBusy(true)

    try {
      const nextBypassList = currentHostBypassed
        ? bypassList.filter((item) => item !== currentHost)
        : [...bypassList, currentHost]
      const nextProfile = normalizeProfileFromForm(profile, nextBypassList.join('\n'))

      await networkProxyProfile.setValue(nextProfile)
      setProfile(nextProfile)
      setBypassText(nextProfile.bypassList.join('\n'))

      if (appliedMode === 'scenario') {
        const nextStatus = await sendRuntimeMessage({ type: 'sync-network-proxy' })
        setAppliedMode(nextStatus.mode)
        setStatus(nextStatus)
      } else {
        setStatus(await sendRuntimeMessage({ type: 'get-network-status' }))
      }
    } catch (error) {
      setStatus({
        ok: false,
        mode,
        managed: true,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }

  const refreshNetworkStatus = async () => {
    const nextStatus = await sendRuntimeMessage({ type: 'get-network-status' })
    setAppliedMode(nextStatus.mode)
    setStatus(nextStatus)
  }

  const syncScenarioIfActive = async () => {
    if (appliedMode === 'scenario') {
      const nextStatus = await sendRuntimeMessage({ type: 'sync-network-proxy' })
      setAppliedMode(nextStatus.mode)
      setStatus(nextStatus)
      return
    }

    await refreshNetworkStatus()
  }

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
      await syncScenarioIfActive()
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
      await syncScenarioIfActive()
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

  const useRecommendedRuleList = (url: string) => {
    setRuleListUrl(url)
    setRuleListStatus('')
    setRuleListError(false)
  }

  const statusText = getStatusText(status)
  const ruleListTime = formatRuleListTime(ruleList.lastUpdate)
  const showScenarioSettings = mode === 'scenario'
  const appliedModeLabel = MODE_OPTIONS.find((item) => item.value === appliedMode)?.label
  const saveScenarioLabel = appliedMode === 'scenario' ? '保存并应用' : '保存并启用'

  return (
    <div className='flex flex-col gap-3'>
      <section className='rounded-lg border border-slate-200 bg-white p-3 shadow-sm'>
        <div className='mb-2 flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className='text-sm font-semibold text-slate-800'>网络模式</h2>
            <p className='truncate text-xs text-slate-400'>
              {currentHost ? `当前网页：${currentHost}` : '当前网页不可配置代理'}
            </p>
          </div>
          <span className='shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500'>
            {appliedModeLabel}
          </span>
        </div>

        <div className='grid grid-cols-3 gap-2'>
          {MODE_OPTIONS.map((item) => (
            <button
              key={item.value}
              type='button'
              disabled={busy}
              onClick={() => applyMode(item.value)}
              className={`min-h-[58px] rounded-lg border px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                mode === item.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
              }`}
            >
              <span className='block text-sm font-medium'>{item.label}</span>
              <span className='mt-0.5 block text-[10px] leading-4 text-slate-400'>
                {item.description}
              </span>
            </button>
          ))}
        </div>

        {statusText && (
          <p
            className={`mt-2 text-[10px] leading-4 ${
              status?.ok ? 'text-slate-400' : 'text-rose-500'
            }`}
          >
            {statusText}
          </p>
        )}
      </section>

      {showScenarioSettings && (
        <>
          <section className='rounded-lg border border-slate-200 bg-white p-3 shadow-sm'>
            <div className='mb-2 flex items-center justify-between'>
              <h2 className='text-sm font-semibold text-slate-800'>情境模式</h2>
              <Button onClick={saveScenarioProfile} loading={busy} className='!px-2 !py-1 text-xs'>
                {saveScenarioLabel}
              </Button>
            </div>

            <div className='grid grid-cols-[92px_1fr_72px] gap-2'>
              <Select
                value={profile.scheme}
                options={SCHEME_OPTIONS}
                onChange={(value) =>
                  setProfile((item) => ({ ...item, scheme: value as NetworkProxyScheme }))
                }
              />
              <input
                value={profile.host}
                placeholder='127.0.0.1'
                onChange={(event) => setProfile((item) => ({ ...item, host: event.target.value }))}
                className='min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
              />
              <input
                value={profile.port || ''}
                inputMode='numeric'
                placeholder='7890'
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '')
                  setProfile((item) => ({ ...item, port: digits ? Number(digits) : 0 }))
                }}
                className='min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
              />
            </div>
          </section>

          <section className='rounded-lg border border-slate-200 bg-white p-3 shadow-sm'>
            <div className='mb-2 flex items-center justify-between gap-3'>
              <div className='min-w-0'>
                <h2 className='text-sm font-semibold text-slate-800'>规则列表</h2>
                <p className='truncate text-xs text-slate-400'>
                  {ruleList.lastUpdate
                    ? `${ruleListTime} · ${ruleList.proxyRuleCount} 条代理规则`
                    : 'AutoProxy / GFWList'}
                </p>
              </div>
              <Switch
                checked={ruleList.enabled}
                onChange={toggleRuleList}
                disabled={ruleListBusy}
              />
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
              启用后命中规则走情境代理，未命中规则直连；未启用时情境模式保持全局代理。
            </p>
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {RECOMMENDED_RULE_LISTS.map((item) => (
                <button
                  key={item.url}
                  type='button'
                  title={item.url}
                  onClick={() => useRecommendedRuleList(item.url)}
                  className={`rounded border px-2 py-1 text-[10px] leading-4 transition-colors ${
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
          </section>

          <section className='rounded-lg border border-slate-200 bg-white p-3 shadow-sm'>
            <div className='mb-2 flex items-center justify-between gap-2'>
              <h2 className='text-sm font-semibold text-slate-800'>绕过列表</h2>
              <Button
                disabled={!currentHost}
                onClick={toggleCurrentHostBypass}
                loading={busy}
                className='!px-2 !py-1 text-xs'
              >
                {currentHostBypassed ? '取消直连' : '当前站点直连'}
              </Button>
            </div>
            <textarea
              value={bypassText}
              rows={4}
              spellCheck={false}
              onChange={(event) => setBypassText(event.target.value)}
              placeholder={'<local>\nlocalhost\n127.0.0.1'}
              className='w-full resize-none rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs leading-5 text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
            />
            <p className='mt-1.5 text-[10px] leading-4 text-slate-400'>
              每行一个域名或 Chrome 代理绕过规则；仅在情境模式中生效。
            </p>
          </section>
        </>
      )}
    </div>
  )
}
