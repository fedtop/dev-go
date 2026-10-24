import { useEffect, useRef } from 'react'

import {
  colorPanelsFragmentShader,
  emptyPixel,
  GemSmokeShapes,
  gemSmokeFragmentShader,
  getShaderColorFromString,
  getShaderNoiseTexture,
  GrainGradientShapes,
  grainGradientFragmentShader,
  heatmapFragmentShader,
  meshGradientFragmentShader,
  metaballsFragmentShader,
  neuroNoiseFragmentShader,
  ShaderFitOptions,
  ShaderMount,
  simplexNoiseFragmentShader,
  smokeRingFragmentShader,
  toProcessedHeatmap,
  voronoiFragmentShader,
  WarpPatterns,
  warpFragmentShader,
  waterFragmentShader,
  type ShaderMountUniforms,
} from '@paper-design/shaders'

import type { NewtabShaderEffect } from '@/utils/settings'

const SHADER_MAX_PIXELS = 1920 * 1080
const DEFAULT_FRAME = 18_000

export const SHADER_EFFECT_OPTIONS = [
  { id: 'mesh', label: '流体' },
  { id: 'neuro', label: '神经' },
  { id: 'simplex', label: '柔波' },
  { id: 'smoke', label: '烟环' },
  { id: 'metaballs', label: '熔球' },
  { id: 'voronoi', label: '晶格' },
  { id: 'warp', label: '扭曲' },
  { id: 'heatmap', label: '热流' },
  { id: 'grain', label: '颗粒' },
  { id: 'panels', label: '彩幕' },
  { id: 'water', label: '水波' },
  { id: 'gem', label: '宝石' },
] satisfies Array<{ id: NewtabShaderEffect; label: string }>

interface ShaderAssets {
  emptyImage?: HTMLImageElement
  heatmapImage?: HTMLImageElement
  noiseTexture?: HTMLImageElement
}

interface ShaderEffectConfig {
  fragmentShader: string
  speed: number
  frame: number
  needsEmptyImage?: boolean
  needsHeatmapImage?: boolean
  needsNoiseTexture?: boolean
  getUniforms: (dark: boolean, assets: ShaderAssets) => ShaderMountUniforms
}

type ShaderColor = [number, number, number, number]

let emptyImagePromise: Promise<HTMLImageElement> | null = null
let heatmapImagePromise: Promise<HTMLImageElement> | null = null
let noiseTexturePromise: Promise<HTMLImageElement> | null = null

const HEATMAP_MASK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720" width="720" height="720">
  <rect width="720" height="720" fill="white"/>
  <path fill="black" d="M356 94c72 42 87 116 136 164 43 42 109 56 128 122 23 78-28 153-95 191-60 34-130 32-198 36-77 4-163 8-211-52-48-59-28-146 5-215 27-57 83-82 125-128 36-40 59-89 110-118Z"/>
  <path fill="white" fill-opacity=".22" d="M302 225c41-51 109-66 160-27 50 38 57 111 17 163-42 54-116 68-164 29-48-38-54-111-13-165Z"/>
</svg>
`)}`

function color(value: string): [number, number, number, number] {
  return getShaderColorFromString(value)
}

function isShaderColor(value: unknown): value is ShaderColor {
  return (
    Array.isArray(value) && value.length === 4 && value.every((item) => typeof item === 'number')
  )
}

function boostLightColor([red, green, blue, alpha]: ShaderColor): ShaderColor {
  return [red * 0.88, green * 0.88, blue * 0.88, Math.min(1, alpha * 1.45 + 0.05)]
}

function boostLightUniforms(uniforms: ShaderMountUniforms): ShaderMountUniforms {
  const next: ShaderMountUniforms = {}

  Object.entries(uniforms).forEach(([key, value]) => {
    if (isShaderColor(value)) {
      next[key] = boostLightColor(value)
      return
    }
    if (Array.isArray(value) && value.every(isShaderColor)) {
      next[key] = value.map((item) => boostLightColor(item))
      return
    }
    next[key] = value
  })

  return next
}

function getThemeUniforms(
  config: ShaderEffectConfig,
  dark: boolean,
  assets: ShaderAssets,
): ShaderMountUniforms {
  const uniforms = config.getUniforms(dark, assets)
  return dark ? uniforms : boostLightUniforms(uniforms)
}

function waitForImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve(image)

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)
    }
    const handleLoad = () => {
      cleanup()
      resolve(image)
    }
    const handleError = () => {
      cleanup()
      reject(new Error('Paper shader texture failed to load'))
    }

    image.addEventListener('load', handleLoad, { once: true })
    image.addEventListener('error', handleError, { once: true })
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = src
  return waitForImage(image)
}

function loadEmptyImage(): Promise<HTMLImageElement> {
  emptyImagePromise ??= loadImage(emptyPixel)
  return emptyImagePromise
}

function loadHeatmapImage(): Promise<HTMLImageElement> {
  heatmapImagePromise ??= (async () => {
    const { blob } = await toProcessedHeatmap(HEATMAP_MASK)
    const url = URL.createObjectURL(blob)
    return loadImage(url)
  })()
  return heatmapImagePromise
}

function createNoiseTexture(): Promise<HTMLImageElement> {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Paper shader noise texture failed to initialize')

  const imageData = context.createImageData(size, size)
  for (let index = 0; index < imageData.data.length; index += 4) {
    imageData.data[index] = Math.floor(Math.random() * 256)
    imageData.data[index + 1] = Math.floor(Math.random() * 256)
    imageData.data[index + 2] = Math.floor(Math.random() * 256)
    imageData.data[index + 3] = 255
  }
  context.putImageData(imageData, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Paper shader noise texture failed to encode'))
        return
      }
      loadImage(URL.createObjectURL(blob)).then(resolve, reject)
    }, 'image/png')
  })
}

function loadNoiseTexture(): Promise<HTMLImageElement> {
  noiseTexturePromise ??= (async () => {
    const image = getShaderNoiseTexture()
    if (!image) return createNoiseTexture()

    try {
      return await waitForImage(image)
    } catch (_error) {
      return createNoiseTexture()
    }
  })()
  return noiseTexturePromise
}

async function loadAssets(config: ShaderEffectConfig): Promise<ShaderAssets> {
  const [emptyImage, heatmapImage, noiseTexture] = await Promise.all([
    config.needsEmptyImage ? loadEmptyImage() : undefined,
    config.needsHeatmapImage ? loadHeatmapImage() : undefined,
    config.needsNoiseTexture ? loadNoiseTexture() : undefined,
  ])

  return { emptyImage, heatmapImage, noiseTexture }
}

function sizing(
  dark: boolean,
  options: Partial<Record<'scale' | 'rotation' | 'offsetX' | 'offsetY', number>> = {},
): ShaderMountUniforms {
  return {
    u_fit: ShaderFitOptions.cover,
    u_scale: options.scale ?? (dark ? 1.18 : 1.06),
    u_rotation: options.rotation ?? (dark ? -8 : -5),
    u_originX: 0.5,
    u_originY: 0.5,
    u_offsetX: options.offsetX ?? 0,
    u_offsetY: options.offsetY ?? (dark ? -0.03 : -0.01),
    u_worldWidth: 0,
    u_worldHeight: 0,
  }
}

function noiseUniform(assets: ShaderAssets): ShaderMountUniforms {
  return assets.noiseTexture ? { u_noiseTexture: assets.noiseTexture } : {}
}

function imageUniform(assets: ShaderAssets): ShaderMountUniforms {
  return assets.emptyImage ? { u_image: assets.emptyImage } : {}
}

function heatmapImageUniform(assets: ShaderAssets): ShaderMountUniforms {
  return assets.heatmapImage ? { u_image: assets.heatmapImage } : {}
}

const EFFECT_CONFIG: Record<NewtabShaderEffect, ShaderEffectConfig> = {
  mesh: {
    fragmentShader: meshGradientFragmentShader,
    speed: 0.5,
    frame: DEFAULT_FRAME,
    getUniforms: (dark) => ({
      ...sizing(dark),
      u_colors: dark
        ? [
            color('rgba(20, 184, 166, 0.78)'),
            color('rgba(59, 130, 246, 0.64)'),
            color('rgba(249, 115, 22, 0.52)'),
            color('rgba(226, 232, 240, 0.28)'),
          ]
        : [
            color('rgba(14, 165, 233, 0.46)'),
            color('rgba(45, 212, 191, 0.42)'),
            color('rgba(251, 146, 60, 0.32)'),
            color('rgba(244, 114, 182, 0.24)'),
          ],
      u_colorsCount: 4,
      u_distortion: dark ? 0.68 : 0.48,
      u_swirl: dark ? 0.5 : 0.32,
      u_grainMixer: 0.34,
      u_grainOverlay: dark ? 0.18 : 0.08,
    }),
  },
  neuro: {
    fragmentShader: neuroNoiseFragmentShader,
    speed: 0.16,
    frame: 9_000,
    getUniforms: (dark) => ({
      ...sizing(dark, { scale: dark ? 1.12 : 1.02, rotation: 0 }),
      u_colorFront: dark ? color('rgba(125, 211, 252, 0.92)') : color('rgba(14, 116, 144, 0.42)'),
      u_colorMid: dark ? color('rgba(45, 212, 191, 0.56)') : color('rgba(20, 184, 166, 0.25)'),
      u_colorBack: dark ? color('rgba(7, 10, 23, 0.92)') : color('rgba(245, 250, 255, 0.86)'),
      u_brightness: dark ? 0.42 : 0.24,
      u_contrast: dark ? 0.48 : 0.28,
    }),
  },
  simplex: {
    fragmentShader: simplexNoiseFragmentShader,
    speed: 0.12,
    frame: 24_000,
    getUniforms: (dark) => ({
      ...sizing(dark, { scale: dark ? 0.9 : 0.78, rotation: dark ? 12 : 8 }),
      u_colors: dark
        ? [
            color('rgba(15, 23, 42, 0.95)'),
            color('rgba(14, 165, 233, 0.58)'),
            color('rgba(20, 184, 166, 0.48)'),
            color('rgba(248, 113, 113, 0.38)'),
          ]
        : [
            color('rgba(239, 246, 255, 0.92)'),
            color('rgba(125, 211, 252, 0.42)'),
            color('rgba(134, 239, 172, 0.28)'),
            color('rgba(253, 186, 116, 0.3)'),
          ],
      u_colorsCount: 4,
      u_stepsPerColor: 3,
      u_softness: dark ? 0.74 : 0.86,
    }),
  },
  smoke: {
    fragmentShader: smokeRingFragmentShader,
    speed: 0.12,
    frame: 12_000,
    needsNoiseTexture: true,
    getUniforms: (dark, assets) => ({
      ...sizing(dark, { scale: dark ? 1.36 : 1.28, rotation: 8 }),
      ...noiseUniform(assets),
      u_colorBack: dark ? color('rgba(5, 8, 18, 0.7)') : color('rgba(247, 250, 252, 0.56)'),
      u_colors: dark
        ? [
            color('rgba(56, 189, 248, 0.58)'),
            color('rgba(45, 212, 191, 0.52)'),
            color('rgba(251, 146, 60, 0.36)'),
          ]
        : [
            color('rgba(14, 165, 233, 0.38)'),
            color('rgba(16, 185, 129, 0.34)'),
            color('rgba(251, 146, 60, 0.26)'),
          ],
      u_colorsCount: 3,
      u_noiseScale: 1.4,
      u_thickness: 0.48,
      u_radius: 0.42,
      u_innerShape: 1.2,
      u_noiseIterations: 6,
    }),
  },
  metaballs: {
    fragmentShader: metaballsFragmentShader,
    speed: 0.16,
    frame: 16_000,
    needsNoiseTexture: true,
    getUniforms: (dark, assets) => ({
      ...sizing(dark, { scale: dark ? 1.14 : 1.02 }),
      ...noiseUniform(assets),
      u_colorBack: dark ? color('rgba(5, 9, 20, 0.66)') : color('rgba(246, 249, 252, 0.48)'),
      u_colors: dark
        ? [
            color('rgba(45, 212, 191, 0.78)'),
            color('rgba(59, 130, 246, 0.68)'),
            color('rgba(251, 146, 60, 0.52)'),
          ]
        : [
            color('rgba(20, 184, 166, 0.54)'),
            color('rgba(14, 165, 233, 0.5)'),
            color('rgba(251, 146, 60, 0.36)'),
          ],
      u_colorsCount: 3,
      u_count: 14,
      u_size: 0.42,
    }),
  },
  voronoi: {
    fragmentShader: voronoiFragmentShader,
    speed: 0.09,
    frame: 18_000,
    needsNoiseTexture: true,
    getUniforms: (dark, assets) => ({
      ...sizing(dark, { scale: dark ? 0.82 : 0.72, rotation: 4 }),
      ...noiseUniform(assets),
      u_colors: dark
        ? [
            color('rgba(15, 23, 42, 0.88)'),
            color('rgba(14, 165, 233, 0.52)'),
            color('rgba(20, 184, 166, 0.44)'),
          ]
        : [
            color('rgba(239, 246, 255, 0.82)'),
            color('rgba(125, 211, 252, 0.36)'),
            color('rgba(134, 239, 172, 0.26)'),
          ],
      u_colorsCount: 3,
      u_stepsPerColor: 2,
      u_colorGap: dark ? color('rgba(226, 232, 240, 0.18)') : color('rgba(15, 23, 42, 0.1)'),
      u_colorGlow: dark ? color('rgba(45, 212, 191, 0.22)') : color('rgba(14, 165, 233, 0.16)'),
      u_distortion: 0.22,
      u_gap: 0.024,
      u_glow: 0.42,
    }),
  },
  warp: {
    fragmentShader: warpFragmentShader,
    speed: 0.16,
    frame: 14_000,
    needsNoiseTexture: true,
    getUniforms: (dark, assets) => ({
      ...sizing(dark, { scale: dark ? 0.88 : 0.78, rotation: -7 }),
      ...noiseUniform(assets),
      u_colors: dark
        ? [
            color('rgba(20, 184, 166, 0.72)'),
            color('rgba(59, 130, 246, 0.62)'),
            color('rgba(251, 146, 60, 0.46)'),
          ]
        : [
            color('rgba(14, 165, 233, 0.48)'),
            color('rgba(16, 185, 129, 0.38)'),
            color('rgba(251, 146, 60, 0.3)'),
          ],
      u_colorsCount: 3,
      u_proportion: 0.42,
      u_softness: 0.82,
      u_shape: WarpPatterns.edge,
      u_shapeScale: 0.34,
      u_distortion: 0.66,
      u_swirl: 0.6,
      u_swirlIterations: 10,
    }),
  },
  heatmap: {
    fragmentShader: heatmapFragmentShader,
    speed: 0.14,
    frame: 17_000,
    needsHeatmapImage: true,
    getUniforms: (dark, assets) => ({
      ...sizing(dark, { scale: dark ? 1.08 : 0.98, rotation: dark ? -6 : -3, offsetY: -0.02 }),
      ...heatmapImageUniform(assets),
      u_colorBack: dark ? color('rgba(4, 7, 15, 0.6)') : color('rgba(248, 250, 252, 0.42)'),
      u_colors: dark
        ? [
            color('rgba(15, 23, 42, 0.16)'),
            color('rgba(56, 189, 248, 0.48)'),
            color('rgba(45, 212, 191, 0.68)'),
            color('rgba(251, 146, 60, 0.54)'),
            color('rgba(244, 114, 182, 0.34)'),
          ]
        : [
            color('rgba(255, 255, 255, 0.12)'),
            color('rgba(14, 165, 233, 0.28)'),
            color('rgba(16, 185, 129, 0.38)'),
            color('rgba(251, 146, 60, 0.32)'),
            color('rgba(236, 72, 153, 0.2)'),
          ],
      u_colorsCount: 5,
      u_contour: 0.68,
      u_angle: dark ? 28 : -18,
      u_noise: 0.18,
      u_innerGlow: 0.76,
      u_outerGlow: 0.5,
    }),
  },
  grain: {
    fragmentShader: grainGradientFragmentShader,
    speed: 0.13,
    frame: 23_000,
    needsNoiseTexture: true,
    getUniforms: (dark, assets) => ({
      ...sizing(dark, { scale: dark ? 1.08 : 0.96, rotation: 9 }),
      ...noiseUniform(assets),
      u_colorBack: dark ? color('rgba(6, 10, 22, 0.68)') : color('rgba(248, 250, 252, 0.5)'),
      u_colors: dark
        ? [
            color('rgba(45, 212, 191, 0.58)'),
            color('rgba(59, 130, 246, 0.5)'),
            color('rgba(251, 146, 60, 0.34)'),
          ]
        : [
            color('rgba(14, 165, 233, 0.36)'),
            color('rgba(16, 185, 129, 0.3)'),
            color('rgba(251, 146, 60, 0.24)'),
          ],
      u_colorsCount: 3,
      u_softness: 0.72,
      u_intensity: 0.58,
      u_noise: 0.28,
      u_shape: GrainGradientShapes.blob,
    }),
  },
  panels: {
    fragmentShader: colorPanelsFragmentShader,
    speed: 0.11,
    frame: 12_000,
    getUniforms: (dark) => ({
      ...sizing(dark, { scale: dark ? 1.18 : 1.04, rotation: 0 }),
      u_colors: dark
        ? [
            color('rgba(45, 212, 191, 0.4)'),
            color('rgba(59, 130, 246, 0.34)'),
            color('rgba(251, 146, 60, 0.26)'),
          ]
        : [
            color('rgba(14, 165, 233, 0.26)'),
            color('rgba(16, 185, 129, 0.22)'),
            color('rgba(251, 146, 60, 0.18)'),
          ],
      u_colorsCount: 3,
      u_colorBack: dark ? color('rgba(5, 8, 18, 0.62)') : color('rgba(248, 250, 252, 0.44)'),
      u_angle1: 0.26,
      u_angle2: -0.18,
      u_length: 1.5,
      u_edges: true,
      u_blur: 0.2,
      u_fadeIn: 0.24,
      u_fadeOut: 0.54,
      u_density: 1.2,
      u_gradient: 0.72,
    }),
  },
  water: {
    fragmentShader: waterFragmentShader,
    speed: 0.14,
    frame: 15_000,
    needsEmptyImage: true,
    getUniforms: (dark, assets) => ({
      ...sizing(dark, { scale: dark ? 1.02 : 0.96 }),
      ...imageUniform(assets),
      u_colorBack: dark ? color('rgba(5, 12, 24, 0.68)') : color('rgba(240, 249, 255, 0.54)'),
      u_colorHighlight: dark
        ? color('rgba(125, 211, 252, 0.62)')
        : color('rgba(14, 165, 233, 0.34)'),
      u_highlights: 0.72,
      u_layering: 0.62,
      u_edges: 0.2,
      u_caustic: 0.7,
      u_waves: 0.5,
      u_size: 2.2,
    }),
  },
  gem: {
    fragmentShader: gemSmokeFragmentShader,
    speed: 0.12,
    frame: 30_000,
    needsEmptyImage: true,
    getUniforms: (dark, assets) => ({
      ...sizing(dark, { scale: dark ? 1.18 : 1.08, offsetY: -0.04 }),
      ...imageUniform(assets),
      u_colorBack: dark ? color('rgba(5, 8, 18, 0.6)') : color('rgba(248, 250, 252, 0.4)'),
      u_colors: dark
        ? [
            color('rgba(45, 212, 191, 0.58)'),
            color('rgba(59, 130, 246, 0.5)'),
            color('rgba(251, 146, 60, 0.34)'),
          ]
        : [
            color('rgba(14, 165, 233, 0.34)'),
            color('rgba(16, 185, 129, 0.28)'),
            color('rgba(251, 146, 60, 0.22)'),
          ],
      u_colorsCount: 3,
      u_innerDistortion: 0.46,
      u_outerDistortion: 0.68,
      u_outerGlow: 0.52,
      u_innerGlow: 0.38,
      u_colorInner: dark ? color('rgba(226, 232, 240, 0.18)') : color('rgba(255, 255, 255, 0.22)'),
      u_offset: -0.08,
      u_angle: 28,
      u_size: 0.7,
      u_shape: GemSmokeShapes.diamond,
      u_isImage: false,
    }),
  },
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark')
}

/**
 * Paper Shaders 动态背景。CSS 基底负责兜底，WebGL 可用时在上方渲染动态 shader。
 */
export default function QuietBackground({ effect }: { effect: NewtabShaderEffect }) {
  const shaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = shaderRef.current
    if (!node) return undefined

    const config = EFFECT_CONFIG[effect]
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let active = true
    let mount: ShaderMount | null = null
    let assets: ShaderAssets = {}

    const syncMotion = () => {
      mount?.setSpeed(reducedMotion.matches ? 0 : config.speed)
    }
    const syncTheme = () => {
      mount?.setUniforms(getThemeUniforms(config, isDarkTheme(), assets))
    }

    loadAssets(config)
      .then((loadedAssets) => {
        if (!active) return
        assets = loadedAssets
        mount = new ShaderMount(
          node,
          config.fragmentShader,
          getThemeUniforms(config, isDarkTheme(), assets),
          {
            alpha: true,
            antialias: false,
            premultipliedAlpha: false,
            powerPreference: 'low-power',
          },
          reducedMotion.matches ? 0 : config.speed,
          config.frame,
          1,
          SHADER_MAX_PIXELS,
        )
      })
      .catch((error) => {
        console.warn('[DevGo] paper shader background unavailable:', error)
      })

    const themeObserver = new MutationObserver(syncTheme)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    reducedMotion.addEventListener('change', syncMotion)

    return () => {
      active = false
      reducedMotion.removeEventListener('change', syncMotion)
      themeObserver.disconnect()
      mount?.dispose()
      mount = null
    }
  }, [effect])

  return (
    <div aria-hidden='true' className='pointer-events-none fixed inset-0 -z-10 overflow-hidden'>
      <div className='shader-base absolute inset-0' />
      <div ref={shaderRef} className='shader-canvas absolute inset-0 mix-blend-normal' />
      <div className='absolute inset-0 opacity-0 transition-opacity duration-700 dark:opacity-100'>
        <div className='quiet-stars animate-star-twinkle absolute inset-0 motion-reduce:animate-none' />
        <div className='quiet-stars quiet-stars-2 animate-star-twinkle absolute inset-0 [animation-delay:-4.5s] motion-reduce:animate-none' />
      </div>
      <div className='quiet-noise absolute inset-0 opacity-[0.045] dark:opacity-[0.08]' />
      <div className='quiet-vignette absolute inset-0' />
    </div>
  )
}
