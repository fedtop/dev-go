/**
 * WebRTC 防护（网页主环境，document_start）：移除建立 P2P 连接的接口，
 * 网页无法再通过 ICE 候选收集本机 / 公网 IP。由后台按设置用 scripting.registerContentScripts 注册。
 *
 * 用 defineProperty 改成不可写、不可配置的 undefined：网页脚本既拿不到，也不能自行恢复。
 */
export default defineUnlistedScript(() => {
  const names = [
    'RTCPeerConnection',
    'webkitRTCPeerConnection',
    'mozRTCPeerConnection',
    'RTCSessionDescription',
    'RTCIceCandidate',
    'RTCDataChannel',
    'RTCRtpSender',
    'RTCRtpReceiver',
    'RTCRtpTransceiver',
  ]
  for (const name of names) {
    try {
      Object.defineProperty(window, name, {
        value: undefined,
        writable: false,
        configurable: false,
      })
    } catch {
      // 已被定义为不可配置时忽略
    }
  }
})
