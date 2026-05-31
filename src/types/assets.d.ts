// SVG 作为 URL 导入（用于 <img src> 等）
declare module '*.svg' {
  const url: string
  export default url
}
