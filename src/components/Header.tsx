import { Radio } from 'antd'

export default function Header({ active, setActive }) {
  return (
    <div className='flex gap-4 mb-[10px]'>
      <h1 className='text-slate-800 text-xl font-extrabold'>
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
        <Radio.Button value='translate'>翻译</Radio.Button>
        <Radio.Button value='tools'>工具页</Radio.Button>
      </Radio.Group>
    </div>
  )
}
