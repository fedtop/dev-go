/**
 * 浏览器工具栏图标：按当前网络模式给 logo 左下角的圆染色。
 * Chrome 的 action 图标不支持 SVG，这里在 OffscreenCanvas 上重绘打包的
 * PNG 并覆盖一个对应颜色的圆，再以 ImageData 写入（MV3 service worker 可用）。
 */

import { networkMode, networkProxyManaged, type NetworkMode } from '@/utils/settings'

/** 左下角圆在源图中的位置（按 src/assets/icon.png 395×395 实测：圆心 (121, 299)） */
const CIRCLE_CX = 121 / 395
const CIRCLE_CY = 299 / 395
/** 覆盖半径略大于原圆（79/395），以盖住原圆边缘的抗锯齿光晕 */
const CIRCLE_R = 83 / 395

/** auto-icons 产物尺寸（/icons/{size}.png） */
const ICON_SIZES = [16, 32, 48, 128] as const

/**
 * 各模式的圆颜色（灰/黑/蓝/橙）：灰=直连关、黑=系统默认、蓝=规则分流（logo 原色）、橙=全局代理。
 */
const MODE_COLORS: Record<NetworkMode, string> = {
  direct: '#9CA3AF',
  system: '#1F2937',
  global: '#F97316',
  scenario: '#49CBFE',
}

async function drawIcon(size: typeof ICON_SIZES[number], color: string): Promise<ImageData> {
  const url = browser.runtime.getURL(`/icons/${size}.png`)
  const bitmap = await createImageBitmap(await (await fetch(url)).blob())
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable')
  ctx.drawImage(bitmap, 0, 0, size, size)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(CIRCLE_CX * size, CIRCLE_CY * size, CIRCLE_R * size, 0, Math.PI * 2)
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

/** 按网络模式刷新工具栏图标；DevGo 未接管代理时恢复默认图标 */
export async function updateNetworkActionIcon(): Promise<void> {
  const [managed, mode] = await Promise.all([
    networkProxyManaged.getValue(),
    networkMode.getValue(),
  ])

  if (!managed) {
    await browser.action.setIcon({
      path: Object.fromEntries(ICON_SIZES.map((size) => [size, `/icons/${size}.png`])),
    })
    return
  }

  const images = await Promise.all(ICON_SIZES.map((size) => drawIcon(size, MODE_COLORS[mode])))
  await browser.action.setIcon({
    imageData: Object.fromEntries(ICON_SIZES.map((size, i) => [size, images[i]])),
  })
}

export function updateNetworkActionIconSafely(): void {
  updateNetworkActionIcon().catch((error) => {
    console.warn('[DevGo] update action icon failed:', error)
  })
}
