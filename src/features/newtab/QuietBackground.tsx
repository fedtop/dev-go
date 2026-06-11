/**
 * 极光背景：底色在 body 上，这里负责 基底渐变 / 极光光斑 / 星空（深色限定）/ 噪点 / 晕影 五层叠加。
 * 光斑为大尺寸径向渐变，动画只动 transform / opacity（合成器友好），样式见 global.css。
 */
export default function QuietBackground() {
  return (
    <div aria-hidden='true' className='pointer-events-none fixed inset-0 -z-10 overflow-hidden'>
      <div className='aurora-base absolute inset-0' />
      {/* 光斑组：外层做整体色相流转（颜色会缓慢变化），内层各自漂移 */}
      <div className='animate-aurora-hue absolute inset-0 motion-reduce:animate-none'>
        <div className='aurora-blob aurora-1 animate-aurora-1 motion-reduce:animate-none' />
        <div className='aurora-blob aurora-2 animate-aurora-2 motion-reduce:animate-none' />
        <div className='aurora-blob aurora-3 animate-aurora-3 motion-reduce:animate-none' />
      </div>
      {/* 星空：外层控制深色显隐，内层闪烁动画动自己的 opacity，二者相乘互不冲突 */}
      <div className='absolute inset-0 opacity-0 transition-opacity duration-700 dark:opacity-100'>
        <div className='quiet-stars animate-star-twinkle absolute inset-0 motion-reduce:animate-none' />
        <div className='quiet-stars quiet-stars-2 animate-star-twinkle absolute inset-0 [animation-delay:-4.5s] motion-reduce:animate-none' />
      </div>
      <div className='quiet-noise absolute inset-0 opacity-[0.05] dark:opacity-[0.08]' />
      <div className='quiet-vignette absolute inset-0' />
    </div>
  )
}
