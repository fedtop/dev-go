import type { PlasmoContentScript } from 'plasmo'

import { githubEditOnline } from '~script/github-edit-online'

export const config: PlasmoContentScript = {
  matches: ['<all_urls>'],
  run_at: 'document_start',
}

// 仅当DOM加载完成时
window.addEventListener('DOMContentLoaded', () => {
  // console.log('DOM fully loaded and parsed')
  githubEditOnline()
})

const _wr = (type) => {
  const orig = history[type]
  return function () {
    const rv = orig.apply(this, arguments)
    const e = new Event(type)
    e.arguments = arguments
    window.dispatchEvent(e)
    return rv
  }
}
history.pushState = _wr('pushState')
history.replaceState = _wr('replaceState')
window.addEventListener('replaceState', function (e) {
  console.log('THEY DID IT AGAIN! replaceState 111111')
})
window.addEventListener('pushState', (e) => {
  console.log('🚀🚀🚀 / pushState')
  githubEditOnline()
})
