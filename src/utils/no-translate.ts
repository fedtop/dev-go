/** 全站翻译时需忽略的选择器 */
export const commonPassTransSelectors = [
  'pre',
  'code',
  'kbd',
  'samp',
  'textarea',
  'input',
  'select',
  'option',
  'button',
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'math',
  'rp',
  'rt',
  'time',
  '[translate="no"]',
  '[translate=no]',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[aria-hidden="true"]',
  '[role="button"]',
  '[role="code"]',
  '[default-translate]',
  '.notranslate',
  '.imt-notranslate',
  '.no-translate',
  '.no-translate-node',
  '.no-translate-text',
  '.uacc-clickable',
  '.social-share',
  '.post__footer',
  '.share-nav',
  '.o-share',
  '[data-toolbar=share]',
  '.prism-code',
  '.enlighter-code',
  '.rc-CodeBlock',
  'table.highlight',
  'div[class^=codeBlockContent]',
  'div[class^=codeBlockLines]',
  'div[class^=token-line]',
  'div[data-paste-markdown-skip]',
  '.material-icons',
  'material-icon',
  'i.fa',
  'i[class^=fa-]',
  '.google-symbols',
  'span[class^=material-symbols-]',
  '.countdown',
  '.visuallyhidden',
  'span.katex',
  '.math-block',
  '.MathJax_Preview',
  '.MathJax_Display',
  '.math-container',
  '.MathJax',
  '.MathJax_SVG',
  'math-renderer',
  '[aria-labelledby^="MathJax-SVG"]',
  '.mwe-math-element',
  'span.math.inline',
  'span.math.display',
  '.ltx_Math',
  '.mathjax-block',
  '.MathJax_CHTML',
  'span.pretex-inline',
  'span.math-inline',
  '.reference-citations',
  '.code',
  '[data-test="json-editor"]',
  '.jp-CodeMirrorEditor',
  'cds-code-snippet',
  '.interactive-markdown__code',
  'span.variable[translate=no]',
  '#ace-editor',
  'table.processedcode',
]

/** 向后兼容旧命名：翻译时需忽略的标签 */
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
  '.notranslate',
  '.no-translate',
  '.no-translate-node',
  '.no-translate-text',
  // GitHub 专属排除项：代码、文件、导航、元信息、hovercard 等布局敏感区域
  '.react-blob-sticky-header',
  '[data-test-selector="commit-tease-commit-message"]',
  '[data-test-selector="create-branch.developmentForm"]',
  'div.Box-header.position-relative',
  'div.blob-wrapper-embedded',
  'div.Box.Box--condensed.my-2',
  'div.jp-CodeCell',
  '[aria-label="Account"] .markdown-title',
  '.js-repos-container .markdown-title',
  'a.anchor',
  'div.file-navigation + div.Box',
  '[data-testid^="breadcrumbs"]',
  '[data-ga-click*=Star]',
  '.markdown-body h3',
  'div.vcard-names-container',
  'div.js-disable-context-menu',
  '.BorderGrid-cell a[role="link"]',
  '.BorderGrid-cell .topic-tag-link',
  'table[class*="Table-module__Box"]',
  '.author',
  '.assignee',
  '.blob-code',
  '.timeline-comment-header',
  '.review-thread-reply',
  '.codeRepository',
  'a[data-hovercard-type]',
  '[title="Label: Private"]',
  '[aria-label*="language"]',
  '.js-suggested-changes-blob.diff-view',
  'h1[data-component=PH_Title] span[class*="issueNumberText"]',
]

/** 标记不需要被浏览器自带翻译处理的元素（加上 notranslate class） */
export function setNotranslateNode() {
  const selectors = [...commonPassTransSelectors]

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
