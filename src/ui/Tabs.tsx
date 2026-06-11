interface Tab {
  value: string
  label: string
}

interface TabsProps {
  value: string
  tabs: Tab[]
  onChange: (value: string) => void
}

/** 轻量分段标签（替代 antd Segmented） */
export default function Tabs({ value, tabs, onChange }: TabsProps) {
  return (
    <div className='popup-tabs inline-flex rounded-xl p-0.5'>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type='button'
          onClick={() => onChange(tab.value)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
            value === tab.value ? 'is-active shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
