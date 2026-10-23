import TranslateSettings from '@/features/options/TranslateSettings'
import { SHIP_NAME, SITE_URL } from '@/utils/constants'

export default function App() {
  return (
    <div className='popup-shell min-h-screen !max-h-none'>
      <div className='mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10'>
        <header className='flex items-end justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-800'>{SHIP_NAME} 设置</h1>
            <p className='mt-1 text-sm text-slate-400'>翻译引擎、AI 大模型与网页翻译偏好</p>
          </div>
          <a
            href={SITE_URL}
            target='_blank'
            rel='noreferrer'
            className='text-sm text-slate-400 transition-colors hover:text-indigo-600'
          >
            GitHub ↗
          </a>
        </header>
        <TranslateSettings />
      </div>
    </div>
  )
}
