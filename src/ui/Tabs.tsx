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
    <div className='popup-tabs inline-flex rounded-full p-0.5'>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type='button'
          onClick={() => onChange(tab.value)}
          aria-pressed={value === tab.value}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-[color,background-color,box-shadow] duration-150 ${
            value === tab.value ? 'is-active' : ''
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
