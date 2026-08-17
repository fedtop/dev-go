import { useEffect, useMemo, useState } from 'react'

import { getUrlHostname, isValidNetworkProxyProfile, normalizeBypassList } from '@/utils/network'
import { sendRuntimeMessage, type NetworkProxyStatus } from '@/utils/messaging'
import {
  DEFAULT_NETWORK_PROXY_PROFILE,
  DEFAULT_NETWORK_RULE_LIST,
  enableCorsBypass,
  enableReloadOnProxySwitch,
  getNetworkProxyProfile,
  networkActiveCustomProxyModeId,
  networkCustomProxyModeProfiles,
  networkMode,
  networkRuleList,
  setNetworkProxyProfile,
  type NetworkCustomProxyModeProfile,
  type NetworkMode,
  type NetworkProxyProfile,
  type NetworkProxyProfileMode,
  type NetworkProxyScheme,
  type NetworkRuleListConfig,
} from '@/utils/settings'
import Button from '@/ui/Button'
import Select from '@/ui/Select'
import Switch from '@/ui/Switch'

const MODE_OPTIONS: Array<{ value: NetworkMode; label: string; description: string }> = [
  { value: 'direct', label: '直连', description: '不使用代理' },
  { value: 'system', label: '系统代理', description: '跟随系统设置' },
  { value: 'scenario', label: '自动模式', description: '规则自动切换' },
  { value: 'global', label: '代理模式', description: '全部走代理' },
]

const SCHEME_OPTIONS: Array<{ value: NetworkProxyScheme; label: string }> = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks4', label: 'SOCKS4' },
  { value: 'socks5', label: 'SOCKS5' },
]

/** 代理模式与自动模式都依赖下方填写的固定代理（host/port/绕过列表） */
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

const CUSTOM_PROXY_MODE_NAME_MAX = 24

function createDefaultProxyProfile(): NetworkProxyProfile {
  return {
    ...DEFAULT_NETWORK_PROXY_PROFILE,
    bypassList: [...DEFAULT_NETWORK_PROXY_PROFILE.bypassList],
  }
}

function getDefaultBypassText(): string {
  return DEFAULT_NETWORK_PROXY_PROFILE.bypassList.join('\n')
}

function normalizeCustomProxyModeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, CUSTOM_PROXY_MODE_NAME_MAX)
}

function uniqueCustomProxyModeName(name: string, modes: NetworkCustomProxyModeProfile[]): string {
  const used = new Set(modes.map((item) => item.name))
  if (!used.has(name)) return name

  for (let index = 2; index < 100; index += 1) {
    const next = `${name} ${index}`
    if (!used.has(next)) return next
  }

  return `${name} ${Date.now()}`
}

function createCustomProxyModeSnapshot(
  name: string,
  proxyProfile: NetworkProxyProfile,
): NetworkCustomProxyModeProfile {
  return {
    id: crypto.randomUUID(),
    name,
    proxyProfile,
    updatedAt: new Date().toISOString(),
  }
}

function nextCustomProxyModeIdOrEmpty(
  modes: NetworkCustomProxyModeProfile[],
  activeId: string,
): string {
  return modes.some((item) => item.id === activeId) ? activeId : ''
}

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

function proxyProfileModeOf(mode: NetworkMode): NetworkProxyProfileMode | null {
  if (mode === 'global' || mode === 'scenario') return mode
  return null
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
  const [profile, setProfile] = useState<NetworkProxyProfile>(() => createDefaultProxyProfile())
  const [bypassText, setBypassText] = useState(getDefaultBypassText())
  const [ruleList, setRuleList] = useState<NetworkRuleListConfig>(DEFAULT_NETWORK_RULE_LIST)
  const [ruleListUrl, setRuleListUrl] = useState('')
  const [ruleListStatus, setRuleListStatus] = useState('')
  const [ruleListError, setRuleListError] = useState(false)
  const [customProxyModes, setCustomProxyModes] = useState<NetworkCustomProxyModeProfile[]>([])
  const [activeCustomProxyModeId, setActiveCustomProxyModeId] = useState('')
  const [customModeOpen, setCustomModeOpen] = useState(false)
  const [customModeName, setCustomModeName] = useState('')
  const [customModeProfile, setCustomModeProfile] = useState<NetworkProxyProfile>(() =>
    createDefaultProxyProfile(),
  )
  const [customModeDeleteTarget, setCustomModeDeleteTarget] =
    useState<NetworkCustomProxyModeProfile | null>(null)
  const [customModeStatus, setCustomModeStatus] = useState('')
  const [customModeError, setCustomModeError] = useState(false)
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
      networkRuleList.getValue(),
      networkCustomProxyModeProfiles.getValue(),
      networkActiveCustomProxyModeId.getValue(),
      enableReloadOnProxySwitch.getValue(),
      sendRuntimeMessage({ type: 'get-network-status' }).catch(() => null),
      browser.tabs.query({ active: true, currentWindow: true }),
    ]).then(
      async ([
        storedMode,
        storedRuleList,
        storedCustomProxyModes,
        storedActiveCustomProxyModeId,
        storedReload,
        networkStatus,
        tabs,
      ]) => {
        if (!active) return

        const validActiveCustomProxyModeId = storedCustomProxyModes.some(
          (item) => item.id === storedActiveCustomProxyModeId,
        )
          ? storedActiveCustomProxyModeId
          : ''
        const customProfile = storedCustomProxyModes.find(
          (item) => item.id === validActiveCustomProxyModeId,
        )?.proxyProfile
        const storedProfile =
          storedMode === 'global' && customProfile
            ? customProfile
            : await getNetworkProxyProfile(proxyProfileModeOf(storedMode) ?? 'global')
        if (!active) return

        setMode(storedMode)
        setAppliedMode(storedMode)
        setProfile(storedProfile)
        setBypassText(storedProfile.bypassList.join('\n'))
        setRuleList(storedRuleList)
        setRuleListUrl(storedRuleList.url)
        setCustomProxyModes(storedCustomProxyModes)
        setActiveCustomProxyModeId(validActiveCustomProxyModeId)
        setReloadOnSwitch(storedReload)
        setStatus(networkStatus)
        setCurrentHost(getUrlHostname(tabs[0]?.url))

        if (storedActiveCustomProxyModeId && !validActiveCustomProxyModeId) {
          networkActiveCustomProxyModeId.setValue('')
        }
      },
    )

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

  const persistCustomProxyModes = async (
    nextCustomProxyModes: NetworkCustomProxyModeProfile[],
    nextActiveCustomProxyModeId = activeCustomProxyModeId,
  ) => {
    const validActiveCustomProxyModeId = nextCustomProxyModeIdOrEmpty(
      nextCustomProxyModes,
      nextActiveCustomProxyModeId,
    )

    setCustomProxyModes(nextCustomProxyModes)
    setActiveCustomProxyModeId(validActiveCustomProxyModeId)
    await Promise.all([
      networkCustomProxyModeProfiles.setValue(nextCustomProxyModes),
      networkActiveCustomProxyModeId.setValue(validActiveCustomProxyModeId),
    ])
  }

  const openCustomModeDialog = () => {
    setCustomModeStatus('')
    setCustomModeError(false)
    setCustomModeName('')
    setCustomModeProfile(createDefaultProxyProfile())
    setCustomModeOpen(true)
  }

  const closeCustomModeDialog = () => {
    if (busy) return
    setCustomModeOpen(false)
    setCustomModeName('')
    setCustomModeProfile(createDefaultProxyProfile())
    setCustomModeStatus('')
    setCustomModeError(false)
  }

  const openCustomModeDeleteDialog = (target: NetworkCustomProxyModeProfile) => {
    if (busy) return
    setCustomModeOpen(false)
    setCustomModeDeleteTarget(target)
    setCustomModeStatus('')
    setCustomModeError(false)
  }

  const closeCustomModeDeleteDialog = () => {
    if (busy) return
    setCustomModeDeleteTarget(null)
  }

  const confirmDeleteCustomMode = async () => {
    if (!customModeDeleteTarget || busy) return
    const removed = await removeCustomProxyMode(customModeDeleteTarget.id)
    if (removed) {
      setCustomModeDeleteTarget(null)
    }
  }

  const getCurrentProfileTarget = (): NetworkProxyProfileMode | 'custom' | null => {
    if (mode === 'global' && activeCustomProxyModeId) return 'custom'
    return proxyProfileModeOf(mode)
  }

  const persistNormalizedProxyProfile = async (nextProfile: NetworkProxyProfile) => {
    const target = getCurrentProfileTarget()
    if (!target) return false

    if (target === 'custom') {
      const nextCustomProxyModes = customProxyModes.map((item) =>
        item.id === activeCustomProxyModeId
          ? {
              ...item,
              proxyProfile: nextProfile,
              updatedAt: new Date().toISOString(),
            }
          : item,
      )
      setCustomProxyModes(nextCustomProxyModes)
      await networkCustomProxyModeProfiles.setValue(nextCustomProxyModes)
      return true
    }

    await setNetworkProxyProfile(nextProfile, target)
    return true
  }

  const persistProxyProfile = async (): Promise<NetworkProxyProfile | null> => {
    const nextProfile = normalizeProfileFromForm(profile, bypassText)

    if (!isValidNetworkProxyProfile(nextProfile)) {
      setCustomModeError(true)
      setCustomModeStatus('请填写有效的代理主机和端口')
      setStatus({
        ok: false,
        mode,
        managed: true,
        error: '请填写有效的代理主机和端口',
      })
      return null
    }

    await persistNormalizedProxyProfile(nextProfile)
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
    setActiveCustomProxyModeId('')
    setCustomModeOpen(false)
    setCustomModeName('')
    setCustomModeStatus('')
    setCustomModeError(false)

    try {
      await networkActiveCustomProxyModeId.setValue('')

      if (usesProxyProfile(nextMode)) {
        const nextProfile = await getNetworkProxyProfile(proxyProfileModeOf(nextMode) ?? 'global')
        if (!isValidNetworkProxyProfile(nextProfile)) {
          setStatus({
            ok: false,
            mode: nextMode,
            managed: true,
            error: '请填写有效的代理主机和端口',
          })
          return
        }
        setProfile(nextProfile)
        setBypassText(nextProfile.bypassList.join('\n'))
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

  const saveProxyProfile = async () => {
    if (busy) return
    setBusy(true)
    setCustomModeStatus('')
    setCustomModeError(false)

    try {
      const saved = await persistProxyProfile()
      if (!saved) return

      if (usesProxyProfile(mode)) {
        const nextStatus = await sendRuntimeMessage({
          type: 'apply-network-mode',
          mode,
        })
        setMode(nextStatus.mode)
        setAppliedMode(nextStatus.mode)
        setStatus(nextStatus)
        setCustomModeError(!nextStatus.ok)
        setCustomModeStatus(
          nextStatus.ok
            ? activeCustomProxyMode
              ? `已更新「${activeCustomProxyMode.name}」并应用`
              : '已保存并应用到当前模式'
            : nextStatus.error || '代理设置失败',
        )
        return
      }

      if (usesProxyProfile(appliedMode)) {
        const nextStatus = await sendRuntimeMessage({ type: 'sync-network-proxy' })
        setAppliedMode(nextStatus.mode)
        setStatus(nextStatus)
        setCustomModeError(!nextStatus.ok)
        setCustomModeStatus(
          nextStatus.ok ? '已保存并同步到当前代理' : nextStatus.error || '代理设置失败',
        )
        return
      }

      setStatus(await sendRuntimeMessage({ type: 'get-network-status' }))
      setCustomModeStatus('已保存')
    } catch (error) {
      setCustomModeError(true)
      setCustomModeStatus(error instanceof Error ? error.message : String(error))
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

      const persisted = await persistNormalizedProxyProfile(nextProfile)
      setProfile(nextProfile)
      setBypassText(nextProfile.bypassList.join('\n'))

      if (persisted && usesProxyProfile(appliedMode)) {
        const nextStatus = await sendRuntimeMessage({ type: 'sync-network-proxy' })
        setAppliedMode(nextStatus.mode)
        setStatus(nextStatus)
        setCustomModeError(!nextStatus.ok)
        setCustomModeStatus(
          nextStatus.ok
            ? currentHostBypassed
              ? '已取消当前站点直连'
              : '已将当前站点加入直连'
            : nextStatus.error || '代理设置失败',
        )
      } else {
        setStatus(await sendRuntimeMessage({ type: 'get-network-status' }))
        setCustomModeError(false)
        setCustomModeStatus(currentHostBypassed ? '已取消当前站点直连' : '已将当前站点加入直连')
      }
    } catch (error) {
      setCustomModeError(true)
      setCustomModeStatus(error instanceof Error ? error.message : String(error))
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

  const syncProxyIfActive = async () => {
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

  const selectCustomProxyMode = async (customMode: NetworkCustomProxyModeProfile) => {
    if (busy) return
    const prevAppliedMode = appliedMode
    const nextProfile = normalizeProfileFromForm(
      customMode.proxyProfile,
      customMode.proxyProfile.bypassList.join('\n'),
    )

    if (!isValidNetworkProxyProfile(nextProfile)) {
      setStatus({
        ok: false,
        mode: 'global',
        managed: true,
        error: '自定义模式里的代理主机或端口无效',
      })
      return
    }

    setBusy(true)
    setCustomModeOpen(false)
    setCustomModeName('')
    setCustomModeStatus('')
    setCustomModeError(false)

    try {
      await networkActiveCustomProxyModeId.setValue(customMode.id)

      setProfile(nextProfile)
      setBypassText(nextProfile.bypassList.join('\n'))
      setActiveCustomProxyModeId(customMode.id)

      const nextStatus = await sendRuntimeMessage({
        type: 'apply-network-mode',
        mode: 'global',
      })
      setMode(nextStatus.mode)
      setAppliedMode(nextStatus.mode)
      setStatus(nextStatus)
      setCustomModeStatus(`已切换到「${customMode.name}」`)

      if (reloadOnSwitch && nextStatus.ok && nextStatus.mode !== prevAppliedMode) {
        await reloadActiveTab()
      }
    } catch (error) {
      setCustomModeError(true)
      setCustomModeStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const createCustomProxyMode = async () => {
    if (busy) return
    const prevAppliedMode = appliedMode
    const name = normalizeCustomProxyModeName(customModeName)

    if (!name) {
      setCustomModeError(true)
      setCustomModeStatus('请填写自定义模式名称')
      return
    }

    setBusy(true)
    setCustomModeStatus('')
    setCustomModeError(false)

    try {
      const nextProfile = normalizeProfileFromForm(customModeProfile, getDefaultBypassText())
      if (!isValidNetworkProxyProfile(nextProfile)) {
        setCustomModeError(true)
        setCustomModeStatus('请填写有效的代理主机和端口')
        setStatus({
          ok: false,
          mode: 'global',
          managed: true,
          error: '请填写有效的代理主机和端口',
        })
        return
      }

      const nextCustomMode = createCustomProxyModeSnapshot(
        uniqueCustomProxyModeName(name, customProxyModes),
        nextProfile,
      )
      await persistCustomProxyModes([...customProxyModes, nextCustomMode], nextCustomMode.id)

      const nextStatus = await sendRuntimeMessage({
        type: 'apply-network-mode',
        mode: 'global',
      })
      setMode(nextStatus.mode)
      setAppliedMode(nextStatus.mode)
      setStatus(nextStatus)
      setProfile(nextProfile)
      setBypassText(nextProfile.bypassList.join('\n'))

      if (reloadOnSwitch && nextStatus.ok && nextStatus.mode !== prevAppliedMode) {
        await reloadActiveTab()
      }

      setCustomModeName('')
      setCustomModeProfile(createDefaultProxyProfile())
      setCustomModeOpen(false)
      setCustomModeStatus(`已添加「${nextCustomMode.name}」`)
    } catch (error) {
      setCustomModeError(true)
      setCustomModeStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const removeCustomProxyMode = async (id: string) => {
    if (busy) return false
    const target = customProxyModes.find((item) => item.id === id)
    const nextCustomProxyModes = customProxyModes.filter((item) => item.id !== id)
    const removingActiveCustomProxyMode = id === activeCustomProxyModeId
    const nextActiveCustomProxyModeId = removingActiveCustomProxyMode ? '' : activeCustomProxyModeId

    setBusy(true)
    setCustomModeStatus('')
    setCustomModeError(false)

    try {
      await persistCustomProxyModes(nextCustomProxyModes, nextActiveCustomProxyModeId)
      if (removingActiveCustomProxyMode && mode === 'global') {
        const nextProfile = await getNetworkProxyProfile('global')
        setProfile(nextProfile)
        setBypassText(nextProfile.bypassList.join('\n'))
        await syncProxyIfActive()
      }
      setCustomModeStatus(target ? `已删除「${target.name}」` : '自定义模式已删除')
      return true
    } catch (error) {
      setCustomModeError(true)
      setCustomModeStatus(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      setBusy(false)
    }
  }

  const selectRecommendedRuleList = (url: string) => {
    setRuleListUrl(url)
    setRuleListStatus('')
    setRuleListError(false)
  }

  const statusText = getStatusText(status)
  const ruleListTime = formatRuleListTime(ruleList.lastUpdate)
  const activeCustomProxyMode =
    mode === 'global' || appliedMode === 'global'
      ? customProxyModes.find((item) => item.id === activeCustomProxyModeId)
      : undefined
  const showProxySettings = usesProxyProfile(mode) || Boolean(activeCustomProxyMode)
  const showRuleListSettings = mode === 'scenario'
  const canSaveProxyProfile = usesProxyProfile(mode) || Boolean(activeCustomProxyMode)
  const saveProxyLabel = activeCustomProxyMode
    ? '更新并应用'
    : usesProxyProfile(appliedMode)
    ? '保存并应用'
    : '保存并启用'
  const proxyConfigDescription = activeCustomProxyMode
    ? `${activeCustomProxyMode.name} · 自定义代理`
    : mode === 'scenario'
    ? '自动模式 · 独立代理与规则'
    : '代理模式 · 全部流量走代理'

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
          <Button
            onClick={openCustomModeDialog}
            disabled={busy}
            className='shrink-0 !px-2.5 !py-1 text-xs'
          >
            新增
          </Button>
        </div>

        <div className='popup-mode-scroll -mx-1 overflow-x-auto px-1'>
          <div className='flex w-max gap-1.5 pb-1'>
            {MODE_OPTIONS.map((item) => {
              const selected =
                mode === item.value && !(item.value === 'global' && activeCustomProxyMode)
              return (
                <button
                  key={item.value}
                  type='button'
                  disabled={busy}
                  onClick={() => applyMode(item.value)}
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
            {customProxyModes.map((item) => {
              const selected = mode === 'global' && activeCustomProxyModeId === item.id
              return (
                <button
                  key={item.id}
                  type='button'
                  disabled={busy}
                  onClick={() => selectCustomProxyMode(item)}
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

      {customModeOpen && (
        <div
          className='fixed inset-0 z-40 flex items-center justify-center bg-slate-950/20 p-3 backdrop-blur-sm'
          onClick={closeCustomModeDialog}
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
                onClick={closeCustomModeDialog}
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
                  value={customModeName}
                  maxLength={CUSTOM_PROXY_MODE_NAME_MAX}
                  placeholder='代理名称'
                  onChange={(event) => {
                    setCustomModeName(event.target.value)
                    setCustomModeStatus('')
                    setCustomModeError(false)
                  }}
                  className='min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
                />
              </label>

              <div className='grid grid-cols-[92px_1fr_72px] gap-2'>
                <label className='flex min-w-0 flex-col gap-1'>
                  <span className='text-[11px] font-medium text-slate-500'>协议</span>
                  <Select
                    value={customModeProfile.scheme}
                    options={SCHEME_OPTIONS}
                    onChange={(value) =>
                      setCustomModeProfile((item) => ({
                        ...item,
                        scheme: value as NetworkProxyScheme,
                      }))
                    }
                  />
                </label>
                <label className='flex min-w-0 flex-col gap-1'>
                  <span className='text-[11px] font-medium text-slate-500'>Host</span>
                  <input
                    value={customModeProfile.host}
                    placeholder='127.0.0.1'
                    onChange={(event) =>
                      setCustomModeProfile((item) => ({ ...item, host: event.target.value }))
                    }
                    className='min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
                  />
                </label>
                <label className='flex min-w-0 flex-col gap-1'>
                  <span className='text-[11px] font-medium text-slate-500'>端口</span>
                  <input
                    value={customModeProfile.port || ''}
                    inputMode='numeric'
                    placeholder='7890'
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '')
                      setCustomModeProfile((item) => ({
                        ...item,
                        port: digits ? Number(digits) : 0,
                      }))
                    }}
                    className='min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
                  />
                </label>
              </div>
            </div>

            {customModeStatus && (
              <p
                className={`mt-2 text-[10px] leading-4 ${
                  customModeError ? 'text-rose-500' : 'text-slate-500'
                }`}
              >
                {customModeStatus}
              </p>
            )}

            <div className='mt-3 flex justify-end gap-2'>
              <Button onClick={closeCustomModeDialog} disabled={busy} className='!px-2.5 text-xs'>
                取消
              </Button>
              <Button
                variant='primary'
                onClick={createCustomProxyMode}
                loading={busy}
                className='!px-2.5 text-xs'
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {customModeDeleteTarget && (
        <div
          className='fixed inset-0 z-40 flex items-center justify-center bg-slate-950/20 p-3 backdrop-blur-sm'
          onClick={closeCustomModeDeleteDialog}
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
                <p className='mt-1 truncate text-xs font-medium text-slate-700'>
                  「{customModeDeleteTarget.name}」
                </p>
                <p className='mt-1 text-xs leading-5 text-slate-500'>
                  删除后会回到内置代理配置，不影响自动模式、代理模式和其他自定义模式。
                </p>
              </div>
            </div>

            {customModeError && customModeStatus && (
              <p className='mt-2 rounded-lg border border-rose-100 bg-rose-50/70 px-2.5 py-2 text-[10px] leading-4 text-rose-600'>
                {customModeStatus}
              </p>
            )}

            <div className='mt-3 flex justify-end gap-2'>
              <Button
                onClick={closeCustomModeDeleteDialog}
                disabled={busy}
                className='!px-2.5 text-xs'
              >
                取消
              </Button>
              <button
                type='button'
                disabled={busy}
                onClick={confirmDeleteCustomMode}
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
      )}

      {showProxySettings && (
        <section className='rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'>
          <div className='mb-2.5 flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <h2 className='text-sm font-semibold text-slate-800'>代理配置</h2>
              <p className='truncate text-xs text-slate-400'>{proxyConfigDescription}</p>
            </div>
            {activeCustomProxyMode && (
              <button
                type='button'
                disabled={busy}
                onClick={() => openCustomModeDeleteDialog(activeCustomProxyMode)}
                className='shrink-0 rounded-lg border border-rose-100 bg-rose-50/70 px-2 py-1 text-[10px] font-medium text-rose-600 transition-[transform,border-color,background-color] duration-150 ease-out hover:border-rose-200 hover:bg-rose-50 enabled:active:translate-y-px enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
              >
                删除该模式
              </button>
            )}
          </div>

          <div className='space-y-3'>
            <div>
              <h3 className='mb-1.5 text-xs font-semibold text-slate-700'>代理服务器</h3>
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
                  onChange={(event) =>
                    setProfile((item) => ({ ...item, host: event.target.value }))
                  }
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
            </div>

            {showRuleListSettings && (
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
            )}

            <div className='border-t border-slate-100 pt-3'>
              <div className='mb-2 flex items-center justify-between gap-2'>
                <h3 className='text-xs font-semibold text-slate-700'>
                  绕过列表（不走当前代理的域名）
                </h3>
                <Button
                  disabled={!currentHost || busy}
                  onClick={toggleCurrentHostBypass}
                  className='!px-2 !py-1 text-xs'
                >
                  {currentHostBypassed ? '取消直连' : '当前站点直连'}
                </Button>
              </div>
              <textarea
                value={bypassText}
                rows={3}
                spellCheck={false}
                onChange={(event) => setBypassText(event.target.value)}
                placeholder={'<local>\n127.0.0.1\n*.dev.local'}
                className='w-full resize-none rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs leading-5 text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
              />
              <p className='mt-1.5 text-[10px] leading-4 text-slate-400'>
                每行一个域名或 Chrome 代理绕过规则；支持 `*.example.com`
                匹配子域名。代理模式、自动模式与每个自定义代理模式都会独立保存。
              </p>
            </div>
          </div>

          <div className='mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5'>
            <p
              className={`min-w-0 flex-1 truncate text-[10px] leading-4 ${
                customModeError ? 'text-rose-500' : 'text-slate-400'
              }`}
            >
              {customModeStatus || '更改后保存到当前模式'}
            </p>
            {canSaveProxyProfile && (
              <Button
                variant='primary'
                onClick={saveProxyProfile}
                loading={busy}
                className='shrink-0 !px-2.5 !py-1 text-xs'
              >
                {saveProxyLabel}
              </Button>
            )}
          </div>
        </section>
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
