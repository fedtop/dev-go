import { useEffect, useMemo, useState } from 'react'

import { getUrlHostname, isValidNetworkProxyProfile, normalizeBypassList } from '@/utils/network'
import { sendRuntimeMessage, type NetworkProxyStatus } from '@/utils/messaging'
import {
  DEFAULT_NETWORK_PROXY_PROFILE,
  DEFAULT_NETWORK_RULE_LIST,
  enableCorsBypass,
  enableReloadOnProxySwitch,
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
  { value: 'global', label: '代理模式', description: '全部走代理' },
  { value: 'scenario', label: '情境模式', description: '按规则分流' },
]

const SCHEME_OPTIONS: Array<{ value: NetworkProxyScheme; label: string }> = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks4', label: 'SOCKS4' },
  { value: 'socks5', label: 'SOCKS5' },
]

/** 代理模式与情境模式都依赖下方填写的固定代理（host/port/绕过列表） */
function usesProxyProfile(mode: NetworkMode): boolean {
  return mode === 'global' || mode === 'scenario'
}

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
  const [corsOn, setCorsOn] = useState(false)
  const [corsBusy, setCorsBusy] = useState(false)
  const [corsStatus, setCorsStatus] = useState('')
  const [reloadOnSwitch, setReloadOnSwitch] = useState(false)

  const bypassList = useMemo(() => normalizeBypassList(bypassText), [bypassText])
  const currentHostBypassed = Boolean(currentHost && bypassList.includes(currentHost))

  useEffect(() => {
    let active = true

    Promise.all([
      networkMode.getValue(),
      networkProxyProfile.getValue(),
      networkRuleList.getValue(),
      enableReloadOnProxySwitch.getValue(),
      sendRuntimeMessage({ type: 'get-network-status' }).catch(() => null),
      browser.tabs.query({ active: true, currentWindow: true }),
    ]).then(([storedMode, storedProfile, storedRuleList, storedReload, networkStatus, tabs]) => {
      if (!active) return

      setMode(storedMode)
      setAppliedMode(storedMode)
      setProfile(storedProfile)
      setBypassText(storedProfile.bypassList.join('\n'))
      setRuleList(storedRuleList)
      setRuleListUrl(storedRuleList.url)
      setReloadOnSwitch(storedReload)
      setStatus(networkStatus)
      setCurrentHost(getUrlHostname(tabs[0]?.url))
    })

    enableCorsBypass.getValue().then((enabled) => {
      if (!active) return
      setCorsOn(enabled)
      if (enabled) {
        sendRuntimeMessage({ type: 'sync-cors-bypass' }).catch((error) => {
          console.warn('[DevGo] sync CORS bypass failed:', error)
        })
      }
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

  /** 刷新当前激活标签页（“切换代理后刷新页面”开关开启时调用） */
  const reloadActiveTab = async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (tab?.id != null) await browser.tabs.reload(tab.id)
    } catch (error) {
      console.warn('[DevGo] reload active tab failed:', error)
    }
  }

  const applyMode = async (nextMode: NetworkMode) => {
    if (busy) return
    const prevAppliedMode = appliedMode
    setMode(nextMode)
    setBusy(true)

    try {
      if (usesProxyProfile(nextMode)) {
        const saved = await persistScenarioProfile()
        if (!saved) return
      }

      const nextStatus = await sendRuntimeMessage({ type: 'apply-network-mode', mode: nextMode })
      setMode(nextStatus.mode)
      setAppliedMode(nextStatus.mode)
      setStatus(nextStatus)

      if (reloadOnSwitch && nextStatus.ok && nextStatus.mode !== prevAppliedMode) {
        await reloadActiveTab()
      }
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

      if (usesProxyProfile(appliedMode)) {
        const nextStatus = await sendRuntimeMessage({ type: 'sync-network-proxy' })
        setAppliedMode(nextStatus.mode)
        setStatus(nextStatus)
        return
      }

      if (usesProxyProfile(mode)) {
        const nextStatus = await sendRuntimeMessage({
          type: 'apply-network-mode',
          mode,
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

      if (usesProxyProfile(appliedMode)) {
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

  const toggleReloadOnSwitch = async (checked: boolean) => {
    setReloadOnSwitch(checked)
    try {
      await enableReloadOnProxySwitch.setValue(checked)
    } catch (error) {
      console.warn('[DevGo] save reload-on-proxy-switch failed:', error)
    }
  }

  const toggleCors = async (checked: boolean) => {
    if (corsBusy) return
    setCorsBusy(true)
    setCorsStatus('')

    try {
      if (checked) {
        await enableCorsBypass.setValue(true)
        const active = await sendRuntimeMessage({ type: 'sync-cors-bypass' })
        setCorsOn(active)
        setCorsStatus(active ? '已对网页 XHR/fetch 响应补充 CORS 头' : '规则未生效')
        return
      }

      await enableCorsBypass.setValue(false)
      await sendRuntimeMessage({ type: 'sync-cors-bypass' })
      setCorsOn(false)
      setCorsStatus('已关闭')
    } catch (error) {
      console.warn('[DevGo] toggle CORS bypass failed:', error)
      await enableCorsBypass.setValue(false)
      await sendRuntimeMessage({ type: 'sync-cors-bypass' }).catch(() => false)
      setCorsOn(false)
      setCorsStatus('启用失败，请查看扩展权限或重新加载插件')
    } finally {
      setCorsBusy(false)
    }
  }

  const syncScenarioIfActive = async () => {
    if (usesProxyProfile(appliedMode)) {
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
  const showProxySettings = usesProxyProfile(mode)
  const showRuleListSettings = mode === 'scenario'
  const appliedModeLabel = MODE_OPTIONS.find((item) => item.value === appliedMode)?.label
  const saveScenarioLabel = usesProxyProfile(appliedMode) ? '保存并应用' : '保存并启用'

  return (
    <div className='flex flex-col gap-2.5'>
      <section className='rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'>
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

        <div className='grid grid-cols-4 gap-1.5'>
          {MODE_OPTIONS.map((item) => (
            <button
              key={item.value}
              type='button'
              disabled={busy}
              onClick={() => applyMode(item.value)}
              title={item.description}
              className={`min-h-[48px] rounded-lg border px-1 py-1.5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                mode === item.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
              }`}
            >
              <span className='block text-xs font-medium'>{item.label}</span>
              <span className='mt-0.5 block text-[9px] leading-3 text-slate-400'>
                {item.description}
              </span>
            </button>
          ))}
        </div>

        <div className='mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2'>
          <div className='min-w-0'>
            <p className='text-xs font-medium text-slate-700'>切换代理后刷新页面</p>
            <p className='text-[10px] leading-4 text-slate-400'>
              开启后每次切换网络模式都会自动刷新当前网页
            </p>
          </div>
          <Switch checked={reloadOnSwitch} onChange={toggleReloadOnSwitch} />
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

      {showProxySettings && (
        <>
          <section className='rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'>
            <div className='mb-2 flex items-center justify-between'>
              <h2 className='text-sm font-semibold text-slate-800'>代理服务器</h2>
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

          {showRuleListSettings && (
            <section className='rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'>
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
          )}

          <section className='rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'>
            <div className='mb-2 flex items-center justify-between gap-2'>
              <h2 className='text-sm font-semibold text-slate-800'>绕过列表</h2>
              <div className='flex items-center gap-1.5'>
                <Button
                  disabled={!currentHost}
                  onClick={toggleCurrentHostBypass}
                  loading={busy}
                  className='!px-2 !py-1 text-xs'
                >
                  {currentHostBypassed ? '取消直连' : '当前站点直连'}
                </Button>
                <Button
                  onClick={saveScenarioProfile}
                  loading={busy}
                  className='!px-2 !py-1 text-xs'
                >
                  保存
                </Button>
              </div>
            </div>
            <textarea
              value={bypassText}
              rows={3}
              spellCheck={false}
              onChange={(event) => setBypassText(event.target.value)}
              placeholder={'<local>\nlocalhost\n127.0.0.1'}
              className='w-full resize-none rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs leading-5 text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
            />
            <p className='mt-1.5 text-[10px] leading-4 text-slate-400'>
              每行一个域名或 Chrome 代理绕过规则；编辑后点「保存」生效，在代理模式与情境模式中生效。
            </p>
          </section>
        </>
      )}

      <section className='rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'>
        <div className='flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className='text-sm font-semibold text-slate-800'>
              解除 CORS 限制（关闭浏览器“接口跨域”限制）
            </h2>
            <p className='text-xs text-slate-400'>为网页 XHR/fetch 响应补充跨域响应头</p>
          </div>
          <Switch checked={corsOn} onChange={toggleCors} disabled={corsBusy} />
        </div>
        <p className='mt-2 text-[10px] leading-4 text-slate-400'>
          仅用于本地开发调试；无法修复服务器拒绝 OPTIONS、带凭证请求、CSP
          或混合内容限制。开关切换后需刷新页面生效。
        </p>
        {corsStatus && <p className='mt-1 text-[10px] leading-4 text-slate-500'>{corsStatus}</p>}
      </section>
    </div>
  )
}
