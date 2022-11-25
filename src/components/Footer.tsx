export default function Footer() {
  return (
    <p className='flex justify-between'>
      <span className='text-slate-500'>快捷键 Alt+Q 快速切换该面板</span>
      <a
        href={process.env.PLASMO_PUBLIC_SITE_URL}
        className='underline text-fuchsia-400'
        target={'__blank'}
      >
        Github 🌸
      </a>
    </p>
  )
}
