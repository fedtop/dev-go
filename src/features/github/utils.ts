// GitHub 上不算"仓库代码页"的保留路径（个人主页、设置等顶级路径）
const NON_REPO_OWNERS = new Set([
  '',
  'settings',
  'notifications',
  'explore',
  'marketplace',
  'pulls',
  'issues',
  'codespaces',
  'sponsors',
  'dashboard',
  'new',
  'login',
  'logout',
  'search',
  'about',
  'pricing',
  'features',
  'topics',
  'trending',
  'collections',
  'events',
  'organizations',
  'apps',
])

/**
 * 判断当前是否处于 GitHub 的「代码浏览」页面（仅这几类才显示快捷入口）：
 * - 仓库首页              /{owner}/{repo}
 * - 目录                  /{owner}/{repo}/tree/...
 * - 文件                  /{owner}/{repo}/blob/...
 *
 * 其余子页面（issues / pull / actions / wiki / projects / settings / commits 等）
 * 不属于代码浏览，不显示按钮。
 */
export function isGithubCodePage(): boolean {
  if (window.location.hostname !== 'github.com') return false

  const segments = window.location.pathname.split('/').filter(Boolean)
  // 至少要有 owner/repo 两段
  if (segments.length < 2) return false

  const [owner, , tab] = segments
  if (NON_REPO_OWNERS.has(owner.toLowerCase())) return false

  // 仓库首页（只有 owner/repo）
  if (segments.length === 2) return true

  // 仅代码浏览的子路由
  return tab === 'tree' || tab === 'blob'
}

/** 在 github1s 中打开当前仓库路径（比 github.dev 更快） */
export function openInGithub1s() {
  if (!isGithubCodePage()) return
  window.open(`https://github1s.com${window.location.pathname}`, '_blank')
}

/** 在 DeepWiki 打开当前仓库（github.com → deepwiki.com，AI 生成的代码库文档） */
export function openInDeepWiki() {
  if (!isGithubCodePage()) return
  window.open(`https://deepwiki.com${window.location.pathname}`, '_blank')
}
