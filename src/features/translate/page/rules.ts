/**
 * 翻译策略：决定每个元素在切段时如何处理。
 *
 * 优先级：站点 include（强制进入）> 站点 paragraph（整体成段）> 站点 exclude > 通用排除。
 * 被排除的元素若是「行内、有文字、无块级后代」，作为原子节点保留在段落里（译文中原样复制，
 * 如行内 code、时间、@用户名），否则整块跳过并作为段落边界。
 */

import { commonPassTransSelectors } from '@/utils/no-translate'

import { OWN_UI_SELECTOR } from './constants'
import { hasText, type LayoutProbe } from './dom'

export type TranslateVerdict =
  /** 跳过整块，并作为段落边界 */
  | 'skip'
  /** 行内原子：保留在段落文字流中，内部不翻译 */
  | 'atomic'
  /** 整个元素作为一个段落 */
  | 'paragraph'
  /** 强制作为容器继续向内切分 */
  | 'container'

export interface SiteRule {
  name: string
  match: RegExp
  /** 强制翻译（覆盖通用排除），作为容器向内切分 */
  include?: string[]
  /** 整体作为一个段落 */
  paragraph?: string[]
  /** 不翻译 */
  exclude?: string[]
  /** 仅翻译这些区域（为空则整页） */
  roots?: string[]
  /** 翻译期间注入的额外样式 */
  styles?: string
}

/** 永远不参与翻译、也不作为原子保留的元素（交互控件、非内容节点） */
const NEVER_TRANSLATE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'slot',
  'iframe',
  'embed',
  'object',
  'canvas',
  'video',
  'audio',
  'track',
  'source',
  'map',
  'area',
  'img',
  'picture',
  'input',
  'textarea',
  'select',
  'option',
  'optgroup',
  'datalist',
  'button',
  'meter',
  'progress',
  'output',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="textbox"]',
]

/** 通用排除：内容不需要翻译（代码、公式、图标、编辑器、页脚等） */
const DEFAULT_EXCLUDE_SELECTORS = [
  ...commonPassTransSelectors,
  'footer',
  '.monaco-editor',
  '.CodeMirror',
  '.cm-editor',
  '.sr-only',
  '.visually-hidden',
  '.screen-reader-text',
  '[hidden]',
]

/** 行内原子标签：即便未命中排除规则，也在译文中原样保留 */
export const ATOMIC_INLINE_TAGS = new Set([
  'CODE',
  'KBD',
  'SAMP',
  'VAR',
  'TT',
  'MATH',
  'MJX-CONTAINER',
  'TIME',
])

const GITHUB_STYLES = `
.bpDald,
.discussion-title,
[class*='GridCard-module__description'] {
  -webkit-line-clamp: unset !important;
}
#memex-project-view-root [class*=table-row__StyledTableRow-sc],
#memex-project-view-root [class*=base-cell-module__Box] {
  height: unset !important;
}
`

export const SITE_RULES: readonly SiteRule[] = [
  {
    name: 'GitHub',
    match: /^https?:\/\/([^/]+\.)?github\.com\//,
    exclude: [
      // 代码、文件树、diff
      '.react-code-file-contents',
      '.react-tree-show-tree-items',
      '.react-blob-sticky-header',
      '.blob-code',
      '.blob-wrapper-embedded',
      'div.jp-CodeCell',
      '.js-suggested-changes-blob.diff-view',
      'table[class*="Table-module__Box"]',
      // 文件列表里的文件 / 目录名
      '.react-directory-filename-column',
      '.react-directory-filename-cell',
      // 导航、按钮、仓库元信息等布局敏感区域
      '.js-header-wrapper',
      '.file-navigation',
      '.hide-full-screen',
      '.UnderlineNav',
      '.SelectMenu-list',
      '#repository-details-container .pagehead-actions',
      '[data-testid="repo-name-link"]',
      '[itemprop="name"]',
      '.AppHeader-context',
      '[data-testid="repo-visibility-label"]',
      '[class*="prc-Button-ButtonBase"]',
      '[class*="prc-Label-Label"]',
      '.Label',
      '[data-testid^="breadcrumbs"]',
      'nav[aria-label="Breadcrumb"]',
      '.BorderGrid-cell > ul.list-style-none',
      '.BorderGrid-cell a[role="link"]',
      '.BorderGrid-cell .topic-tag-link',
      '.Counter',
      '.octotree-tree-view',
      '.github-repo-size-div',
      // 人名、仓库名、引用链接
      '.commit-author',
      '.author',
      '.assignee',
      '.codeRepository',
      'a[data-hovercard-type]',
      '.timeline-comment-header',
      'relative-time',
      'h1[data-component=PH_Title] span[class*="issueNumberText"]',
      '[aria-label*="language"]',
      '[title="Label: Private"]',
    ],
    styles: GITHUB_STYLES,
  },
  {
    name: 'YouTube',
    match: /^https?:\/\/([^/]+\.)?youtube\.com\//,
    paragraph: ['#description-inline-expander #snippet'],
    exclude: [
      'yt-button-shape',
      'ytd-feed-filter-chip-bar-renderer',
      'ytd-comment-thread-renderer #header',
      'ytd-video-meta-block',
      'ytd-thumbnail-overlay-time-status-renderer',
      'ytd-masthead',
      'ytd-mini-guide-renderer',
      '.caption-window',
      'ytd-video-owner-renderer',
      'ytd-subscribe-button-renderer',
      'ytd-menu-renderer',
      'ytd-comments-header-renderer',
      'ytd-comment-action-buttons-renderer',
      'yt-touch-feedback-shape',
      '.ytd-channel-name',
      '#metadata-line',
    ],
  },
  {
    name: 'Google',
    match: /^https?:\/\/(www\.)?google\.[a-z.]+\//,
    exclude: ['#slim_appbar', 'g-scrolling-carousel', '[role=navigation]', 'cite'],
  },
  {
    name: 'X / Twitter',
    match: /^https?:\/\/(mobile\.)?(twitter|x)\.com\//,
    exclude: [
      '[data-testid=reply]',
      '[data-testid=retweet]',
      '[data-testid=like]',
      '[data-testid=User-Name]',
      '[data-testid=app-text-transition-container]',
    ],
  },
  {
    name: 'Reddit',
    match: /^https?:\/\/([^/]+\.)?reddit\.com\//,
    exclude: [
      '[slot=credit-bar]',
      '[slot=commentMeta]',
      'faceplate-hovercard',
      'faceplate-timeago',
    ],
  },
  {
    name: 'Wikipedia',
    match: /^https?:\/\/([^/]+\.)?wikipedia\.org\//,
    exclude: [
      '#advancedSiteNotices',
      '#section_SpokenWikipedia',
      '.reflist',
      '.refbegin',
      '.mw-editsection',
      'sup.reference',
    ],
  },
  {
    name: 'Stack Overflow',
    match: /^https?:\/\/([^/]+\.)?(stackoverflow|stackexchange|superuser|serverfault)\.com\//,
    exclude: [
      '.s-post-summary--stats',
      '.s-post-summary--meta',
      '.user-info',
      '.comment-date',
      '.comment-user',
      '.js-vote-count',
    ],
  },
  {
    name: 'Medium',
    match: /^https?:\/\/([^/]+\.)?medium\.com\//,
    exclude: ['pre'],
  },
  {
    name: 'Hacker News',
    match: /^https?:\/\/news\.ycombinator\.com\//,
    exclude: ['.subline', '.sitebit', '.rank', '.votelinks', '.navs', '.comhead'],
  },
]

function joinSelectors(selectors: string[]): string {
  // 逐条校验，单条非法选择器（如旧浏览器不支持 :has）不影响其余规则
  return selectors
    .filter((selector) => {
      try {
        document.createDocumentFragment().querySelector(selector)
        return true
      } catch {
        return false
      }
    })
    .join(',')
}

function safeMatches(element: Element, selector: string): boolean {
  if (!selector) return false
  try {
    return element.matches(selector)
  } catch {
    return false
  }
}

export class TranslateRules {
  readonly site: SiteRule | undefined
  private readonly includeSelector: string
  private readonly paragraphSelector: string
  private readonly excludeSelector: string
  private readonly neverSelector: string

  constructor(url: string, private readonly probe: LayoutProbe) {
    this.site = SITE_RULES.find((rule) => rule.match.test(url))
    this.includeSelector = joinSelectors(this.site?.include ?? [])
    this.paragraphSelector = joinSelectors(this.site?.paragraph ?? [])
    this.excludeSelector = joinSelectors([
      ...DEFAULT_EXCLUDE_SELECTORS,
      ...(this.site?.exclude ?? []),
    ])
    this.neverSelector = joinSelectors([OWN_UI_SELECTOR, ...NEVER_TRANSLATE_SELECTORS])
  }

  get roots(): string[] | undefined {
    return this.site?.roots?.length ? this.site.roots : undefined
  }

  get styles(): string {
    return this.site?.styles ?? ''
  }

  /** 返回元素的处理方式；undefined 表示按布局自动判断 */
  verdict(element: Element): TranslateVerdict | undefined {
    if (safeMatches(element, this.neverSelector)) return 'skip'
    if (safeMatches(element, this.includeSelector)) return 'container'
    if (safeMatches(element, this.paragraphSelector)) return 'paragraph'
    if (safeMatches(element, this.excludeSelector) || ATOMIC_INLINE_TAGS.has(element.tagName)) {
      return this.isAtomicCandidate(element) ? 'atomic' : 'skip'
    }
    return undefined
  }

  /**
   * 元素自身或祖先是否已被排除（用于增量切分 / 悬停翻译的起点，
   * 防止从代码块、编辑器内部开始翻译）。
   */
  isInsideExcluded(element: Element): boolean {
    const selector = [this.neverSelector, this.excludeSelector].filter(Boolean).join(',')
    if (!selector) return false
    try {
      const excluded = element.closest(selector)
      return Boolean(excluded) && !(this.includeSelector && excluded?.closest(this.includeSelector))
    } catch {
      return false
    }
  }

  /** 行内、有文字、内部没有块级结构：可以作为原子嵌在段落里 */
  private isAtomicCandidate(element: Element): boolean {
    return (
      this.probe.isInline(element) && !this.probe.hasBlockDescendant(element) && hasText(element)
    )
  }
}
