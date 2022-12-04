export default function Footer() {
  return (
    <p className='mt-[10px] flex justify-between'>
      <span className='text-slate-500'>使用快捷键 Alt+Q 快速切换该面板</span>
      <a
        href={process.env.PLASMO_PUBLIC_SITE_URL}
        className='text-fuchsia-400 underline'
        target={'__blank'}
      >
        Github 🌸
      </a>
    </p>
  )
}
