import type { PlasmoContentScript } from 'plasmo'

export const config: PlasmoContentScript = {
  matches: ['<all_urls>'],
  run_at: 'document_start',
}

window.addEventListener('DOMContentLoaded', () => {
  linkGo()
})

const rules = [
  {
    name: '掘金',
    match: /link.juejin.cn/,
    sign: 'target=',
  },
  {
    name: '知乎',
    match: /link.zhihu.com/,
    sign: 'target=',
  },
  {
    name: '简书',
    match: /jianshu.com\/go-wild/,
    sign: 'target=',
  },
]

// 获取外链的链接地址，然后直接跳转，而不是点击按钮触发网站跳转
export default function linkGo() {
  const url = document.documentURI
  let targetUrl = ''
  rules.forEach((rule) => {
    if (rule.match.test(url)) {
      targetUrl = url.split(rule.sign)[1]
    }
  })
  if (targetUrl) {
    targetUrl = decodeURIComponent(targetUrl)
    window.location.replace(targetUrl)
  }
}
