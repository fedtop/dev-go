/**
 * 去除外链跳转的中间提示页：在掘金 / 知乎 / 简书等站点点击外链时，
 * 直接解析出目标地址并重定向，跳过需要手动点击确认的中转页。
 */

interface RedirectRule {
  name: string
  match: RegExp
  sign: string
}

const rules: RedirectRule[] = [
  { name: '掘金', match: /link\.juejin\.cn/, sign: 'target=' },
  { name: '知乎', match: /link\.zhihu\.com/, sign: 'target=' },
  { name: '简书', match: /jianshu\.com\/go-wild/, sign: 'target=' },
]

export default defineContentScript({
  matches: [
    'https://link.juejin.cn/*',
    'https://link.zhihu.com/*',
    'https://www.jianshu.com/go-wild*',
  ],
  runAt: 'document_start',
  main() {
    const url = document.documentURI

    const rule = rules.find((r) => r.match.test(url))
    if (!rule) return

    const target = url.split(rule.sign)[1]
    if (!target) return

    window.location.replace(decodeURIComponent(target))
  },
})
