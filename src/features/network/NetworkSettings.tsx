import Button from '@/ui/Button'
import Switch from '@/ui/Switch'

import { Card, Row, SectionHeader } from '@/features/options/layout'

import CustomModeDialog from './CustomModeDialog'
import DeleteModeDialog from './DeleteModeDialog'
import ModeSelector from './ModeSelector'
import ProxyServerFields from './ProxyServerFields'
import RuleListSection from './RuleListSection'
import ScenarioRulesSection from './ScenarioRulesSection'
import { useNetworkController } from './useNetworkController'

/** 设置页「网络代理」：网络模式、自定义代理模式、代理服务器、绕过列表与自动模式规则的完整配置 */
export default function NetworkSettings() {
  const c = useNetworkController({ withPageContext: false })

  // 有未保存的代理配置时，关闭或刷新设置页前提醒
  useEffect(() => {
    if (!c.profileDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [c.profileDirty])

  return (
    <div className='flex flex-col gap-5'>
      <SectionHeader
        title='网络代理'
        desc='网络模式与代理配置。弹窗「网络」页可以快速切换模式、把当前网站设为直连或走代理。'
      />

      <Card
        title='网络模式'
        extra={
          <Button
            onClick={c.openCustomModeDialog}
            disabled={c.busy}
            className='!px-2.5 !py-1 text-xs'
          >
            新增自定义模式
          </Button>
        }
      >
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
          <p className={`text-xs ${c.status?.ok ? 'text-slate-400' : 'text-rose-500'}`}>
            {c.statusText}
          </p>
        )}
        <Row label='切换代理后刷新页面' hint='在弹窗里切换网络模式后，自动刷新当前网页'>
          <Switch checked={c.reloadOnSwitch} onChange={c.toggleReloadOnSwitch} />
        </Row>
      </Card>

      {c.showProxySettings ? (
        <Card
          title='代理配置'
          desc={c.proxyConfigDescription}
          extra={
            c.activeCustomProxyMode && (
              <Button
                disabled={c.busy}
                onClick={() =>
                  c.activeCustomProxyMode && c.openCustomModeDeleteDialog(c.activeCustomProxyMode)
                }
                className='!px-2.5 !py-1 text-xs !text-rose-600'
              >
                删除该模式
              </Button>
            )
          }
        >
          <div>
            <h3 className='mb-1.5 text-sm font-medium text-slate-700'>代理服务器</h3>
            <ProxyServerFields profile={c.profile} onChange={c.setProfile} />
          </div>

          {c.showRuleListSettings && (
            <div className='border-t border-slate-100 pt-3'>
              <RuleListSection syncProxyIfActive={c.syncProxyIfActive} />
              <ScenarioRulesSection
                currentHost=''
                disabled={c.busy}
                onHostProxied={() => undefined}
                syncProxyIfActive={c.syncProxyIfActive}
              />
            </div>
          )}

          <div className='border-t border-slate-100 pt-3'>
            <h3 className='mb-1.5 text-sm font-medium text-slate-700'>
              绕过列表（不走当前代理的域名）
            </h3>
            <textarea
              value={c.bypassText}
              rows={8}
              spellCheck={false}
              onChange={(event) => c.setBypassText(event.target.value)}
              placeholder={'<local>\n127.0.0.1\n*.dev.local'}
              className='w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs leading-5 text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'
            />
            <p className='mt-1.5 text-xs leading-relaxed text-slate-400'>
              每行一个域名或 Chrome
              代理绕过规则；代理模式、自动模式与每个自定义代理模式都会独立保存。
            </p>
          </div>

          {/* 吸底：表单很长时保存按钮始终可见；有未保存的改动时高亮提示 */}
          <div
            className={`sticky bottom-3 z-10 -mx-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
              c.profileDirty
                ? 'border-amber-300 bg-amber-50 shadow-md'
                : 'border-slate-100 bg-white/95 backdrop-blur'
            }`}
          >
            <p
              className={`min-w-0 flex-1 truncate text-xs ${
                c.customModeError
                  ? 'text-rose-500'
                  : c.profileDirty
                    ? 'font-medium text-amber-700'
                    : 'text-slate-400'
              }`}
            >
              {c.profileDirty
                ? '代理服务器或绕过列表有未保存的修改，保存后才会生效'
                : c.customModeStatus ||
                  '代理服务器与绕过列表修改后需保存；规则列表与代理域名即时生效'}
            </p>
            {c.canSaveProxyProfile && (
              <Button variant='primary' onClick={c.saveProxyProfile} loading={c.busy}>
                {c.saveProxyLabel}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card
          title='代理配置'
          desc='直连与系统代理模式不需要配置。切换到「自动模式」「代理模式」或自定义模式后，可在这里配置代理服务器、规则列表与绕过列表。'
        >
          <span className='text-xs text-slate-400'>当前模式无需配置</span>
        </Card>
      )}

      {c.customModeOpen && (
        <CustomModeDialog
          name={c.customModeName}
          profile={c.customModeProfile}
          status={c.customModeStatus}
          error={c.customModeError}
          busy={c.busy}
          onNameChange={(name) => {
            c.setCustomModeName(name)
            c.setCustomModeStatus('')
            c.setCustomModeError(false)
          }}
          onProfileChange={c.setCustomModeProfile}
          onClose={c.closeCustomModeDialog}
          onSave={c.createCustomProxyMode}
        />
      )}

      {c.customModeDeleteTarget && (
        <DeleteModeDialog
          name={c.customModeDeleteTarget.name}
          error={c.customModeError ? c.customModeStatus : ''}
          busy={c.busy}
          onClose={c.closeCustomModeDeleteDialog}
          onConfirm={c.confirmDeleteCustomMode}
        />
      )}
    </div>
  )
}
