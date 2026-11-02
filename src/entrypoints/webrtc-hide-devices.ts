/**
 * 隐藏媒体设备（网页主环境，document_start）：navigator.mediaDevices 与旧版 getUserMedia
 * 返回 undefined，网页无法枚举摄像头 / 麦克风（常被用作设备指纹），也无法申请摄像头和麦克风。
 * 由后台按设置用 scripting.registerContentScripts 注册。
 */
export default defineUnlistedScript(() => {
  const hide = (target: object, name: string) => {
    try {
      Object.defineProperty(target, name, {
        get: () => undefined,
        configurable: false,
      })
    } catch {
      // 已被定义为不可配置时忽略
    }
  }
  hide(Navigator.prototype, 'mediaDevices')
  hide(Navigator.prototype, 'getUserMedia')
  hide(Navigator.prototype, 'webkitGetUserMedia')
})
