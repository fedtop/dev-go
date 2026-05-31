/** 翻译时需忽略的标签 */
export const passTransNode = ['pre']

/** 翻译时需忽略的选择器 / class 名 */
export const passTransClass = [
  // 仓库头部导航
  '.hide-full-screen',
  // stars 自定义列表
  '.SelectMenu-list',
  '.bg-gray-light.pt-3.hide-full-screen.mb-5',
  'summary.btn.css-truncate',
  '.commit-author',
  '.js-navigation-open.link-gray-dark',
  '.Box-title',
  '.BorderGrid-cell > div.mt-3 > a.muted-link',
  '.BorderGrid-cell > ul.list-style-none',
  '.hx_page-header-bg',
  '.list-style-none', // 仓库名
  '.text-bold', // 首页人名,仓库名
  'div[data-repository-hovercards-enabled] .body > div .flex-items-baseline',
  '.js-header-wrapper', // nav
  '.file-navigation', // 代码仓库按钮
  '.Details:not(.Details--on) .Details-content--hidden-not-important', // 代码仓库和顶部导航
  // 对于 github 的插件（如 octotree）👇
  '.github-repo-size-div',
  '.octotree-tree-view',
  'notranslate',
  'no-translate',
  'no-translate-node',
  'no-translate-text',
]

/** 标记不需要被浏览器自带翻译处理的元素（加上 notranslate class） */
export function setNotranslateNode() {
  const selectors = [...passTransNode]

  if (window.location.hostname.includes('github')) {
    // github 中不需要翻译的元素，可根据需求自定义配置
    selectors.push(...passTransClass)
  } else {
    // eslint-plugin-vue 等站点中不需要翻译的元素
    selectors.push('.eslint-code-container')
  }

  selectors.forEach((selector) => {
    try {
      document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
        if (!node.classList.contains('notranslate')) {
          node.classList.add('notranslate')
        }
      })
    } catch {
      // 忽略非法选择器（passTransNode 中的纯标签名等）
    }
  })
}
