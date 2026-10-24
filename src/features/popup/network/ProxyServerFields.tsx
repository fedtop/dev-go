import Select from '@/ui/Select'
import type { NetworkProxyProfile, NetworkProxyScheme } from '@/utils/settings'

import { SCHEME_OPTIONS } from './model'

const INPUT_CLASS =
  'min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500'

interface ProxyServerFieldsProps {
  profile: NetworkProxyProfile
  onChange: (update: (profile: NetworkProxyProfile) => NetworkProxyProfile) => void
  /** 是否在各输入框上方显示字段名 */
  labeled?: boolean
}

/** 代理服务器：协议 + 主机 + 端口 */
export default function ProxyServerFields({ profile, onChange, labeled }: ProxyServerFieldsProps) {
  const fields = [
    {
      label: '协议',
      control: (
        <Select
          value={profile.scheme}
          options={SCHEME_OPTIONS}
          onChange={(value) =>
            onChange((item) => ({ ...item, scheme: value as NetworkProxyScheme }))
          }
        />
      ),
    },
    {
      label: 'Host',
      control: (
        <input
          value={profile.host}
          placeholder='127.0.0.1'
          onChange={(event) => onChange((item) => ({ ...item, host: event.target.value }))}
          className={INPUT_CLASS}
        />
      ),
    },
    {
      label: '端口',
      control: (
        <input
          value={profile.port || ''}
          inputMode='numeric'
          placeholder='7890'
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '')
            onChange((item) => ({ ...item, port: digits ? Number(digits) : 0 }))
          }}
          className={INPUT_CLASS}
        />
      ),
    },
  ]

  return (
    <div className='grid grid-cols-[92px_1fr_72px] gap-2'>
      {fields.map(({ label, control }) =>
        labeled ? (
          <label key={label} className='flex min-w-0 flex-col gap-1'>
            <span className='text-[11px] font-medium text-slate-500'>{label}</span>
            {control}
          </label>
        ) : (
          <div key={label} className='contents'>
            {control}
          </div>
        ),
      )}
    </div>
  )
}

export { INPUT_CLASS }
