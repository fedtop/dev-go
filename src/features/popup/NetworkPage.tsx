import { useEffect, useMemo, useState } from 'react'

import Button from '@/ui/Button'
import Switch from '@/ui/Switch'
import { getUrlHostname, isValidNetworkProxyProfile, normalizeBypassList } from '@/utils/network'
import { sendRuntimeMessage, type NetworkProxyStatus } from '@/utils/messaging'
import {
  enableReloadOnProxySwitch,
  getNetworkProxyProfile,
  networkActiveCustomProxyModeId,
  networkCustomProxyModeProfiles,
  networkMode,
  setNetworkProxyProfile,
  type NetworkCustomProxyModeProfile,
  type NetworkMode,
  type NetworkProxyProfile,
  type NetworkProxyProfileMode,
} from '@/utils/settings'

import CorsSection from './network/CorsSection'
import CustomModeDialog from './network/CustomModeDialog'
import DeleteModeDialog from './network/DeleteModeDialog'
import {
  createCustomProxyModeSnapshot,
  createDefaultProxyProfile,
  getDefaultBypassText,
  getStatusText,
  nextCustomProxyModeIdOrEmpty,
  normalizeCustomProxyModeName,
  normalizeProfileFromForm,
  proxyProfileModeOf,
  uniqueCustomProxyModeName,
  usesProxyProfile,
} from './network/model'
import ModeSelector from './network/ModeSelector'
import ProxyServerFields from './network/ProxyServerFields'
import RuleListSection from './network/RuleListSection'

/** 网络面板：网络模式切换、代理配置（含自定义模式、规则列表、绕过列表）与 CORS 调试 */
export default function NetworkPage() {
  const [mode, setMode] = useState<NetworkMode>('system')
  const [appliedMode, setAppliedMode] = useState<NetworkMode>('system')
  const [profile, setProfile] = useState<NetworkProxyProfile>(() => createDefaultProxyProfile())
  const [bypassText, setBypassText] = useState(getDefaultBypassText())
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
  const [reloadOnSwitch, setReloadOnSwitch] = useState(false)

  const bypassList = useMemo(() => normalizeBypassList(bypassText), [bypassText])
  const currentHostBypassed = Boolean(currentHost && bypassList.includes(currentHost))

  useEffect(() => {
    let active = true

    Promise.all([
      networkMode.getValue(),
      networkCustomProxyModeProfiles.getValue(),
      networkActiveCustomProxyModeId.getValue(),
      enableReloadOnProxySwitch.getValue(),
      sendRuntimeMessage({ type: 'get-network-status' }).catch(() => null),
      browser.tabs.query({ active: true, currentWindow: true }),
    ]).then(
      async ([
        storedMode,
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

  const syncProxyIfActive = async () => {
    if (usesProxyProfile(appliedMode)) {
      const nextStatus = await sendRuntimeMessage({ type: 'sync-network-proxy' })
      setAppliedMode(nextStatus.mode)
      setStatus(nextStatus)
      return
    }

    await refreshNetworkStatus()
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

  const statusText = getStatusText(status)
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

        <ModeSelector
          mode={mode}
          customModes={customProxyModes}
          activeCustomModeId={activeCustomProxyModeId}
          customModeActive={Boolean(activeCustomProxyMode)}
          disabled={busy}
          onSelectMode={applyMode}
          onSelectCustomMode={selectCustomProxyMode}
        />

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
        <CustomModeDialog
          name={customModeName}
          profile={customModeProfile}
          status={customModeStatus}
          error={customModeError}
          busy={busy}
          onNameChange={(name) => {
            setCustomModeName(name)
            setCustomModeStatus('')
            setCustomModeError(false)
          }}
          onProfileChange={setCustomModeProfile}
          onClose={closeCustomModeDialog}
          onSave={createCustomProxyMode}
        />
      )}

      {customModeDeleteTarget && (
        <DeleteModeDialog
          name={customModeDeleteTarget.name}
          error={customModeError ? customModeStatus : ''}
          busy={busy}
          onClose={closeCustomModeDeleteDialog}
          onConfirm={confirmDeleteCustomMode}
        />
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
              <ProxyServerFields profile={profile} onChange={setProfile} />
            </div>

            {showRuleListSettings && (
              <div className='border-t border-slate-100 pt-3'>
                <RuleListSection syncProxyIfActive={syncProxyIfActive} />
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
                每行一个域名或 Chrome
                代理绕过规则；代理模式、自动模式与每个自定义代理模式都会独立保存。
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

      <CorsSection />
    </div>
  )
}
