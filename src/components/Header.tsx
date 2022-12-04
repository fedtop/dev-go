import { Radio } from 'antd'

interface Props {
  active: string
  setActive: (active: string) => void
  pages: { key: string; name: string }[]
}

export default function Header({ active, setActive, pages }: Props) {
  return (
    <div className='mb-[10px] flex gap-4'>
      <h1 className='text-xl font-extrabold text-slate-800'>
        🤖 {process.env.PLASMO_PUBLIC_SHIP_NAME}
      </h1>
      <span className='text-lg'>|</span>
      <Radio.Group
        defaultValue={active}
        onChange={(e) => {
          setActive(e.target.value)
        }}
        buttonStyle='solid'
        size='small'
      >
        {pages.map((page) => (
          <Radio.Button key={page.key} value={page.key}>
            {page.name}
          </Radio.Button>
        ))}
      </Radio.Group>
    </div>
  )
}
