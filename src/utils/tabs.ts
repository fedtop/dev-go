/** 当前激活标签页的 hostname；chrome:// 等非网页返回空串 */
export async function getActiveHostname(): Promise<string> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  try {
    const url = new URL(tab?.url ?? '')
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname : ''
  } catch {
    return ''
  }
}
