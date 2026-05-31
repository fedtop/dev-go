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
    <div className='inline-flex rounded-lg bg-slate-100 p-0.5'>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type='button'
          onClick={() => onChange(tab.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === tab.value
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
