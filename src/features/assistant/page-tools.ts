/**
 * 侧边栏助手的内置工具：不依赖网页是否实现 WebMCP，任何网页都能读取正文。
 */
import type { PageContent, TabMessage } from '@/utils/messaging'

import type { FrameTool } from './webmcp-client'

/** 内置工具没有所属 frame，用 -1 与网页工具区分 */
export const BUILTIN_FRAME_ID = -1

export const READ_PAGE_TOOL: FrameTool = {
  name: 'read_page',
  description:
    '读取当前网页的标题、地址、正文（Markdown 格式文本）以及用户选中的文字。' +
    '回答与当前网页内容有关的问题之前先调用它，不要凭空猜测网页内容。',
  inputSchema: { type: 'object', properties: {} },
  readOnly: true,
  annotations: [],
  frameId: BUILTIN_FRAME_ID,
}

export function isBuiltinTool(tool: FrameTool): boolean {
  return tool.frameId === BUILTIN_FRAME_ID
}

/** 读取标签页正文；页面无法注入内容脚本时抛出可读的错误 */
export async function readPage(tabId: number): Promise<PageContent> {
  const message: TabMessage = { type: 'read-page' }
  try {
    const content = (await browser.tabs.sendMessage(tabId, message, { frameId: 0 })) as
      PageContent | undefined
    if (content) return content
  } catch {
    // 落到下面统一提示
  }
  throw new Error('无法读取当前网页：浏览器内置页面不支持；如果是安装扩展前打开的页面，刷新后再试')
}

/** 把网页内容整理成交给模型的文本 */
export function formatPageContent(page: PageContent): string {
  const lines = [`网页标题：${page.title || '（无标题）'}`, `网页地址：${page.url}`]
  if (page.selection) lines.push(`用户当前选中的文字：\n"""\n${page.selection}\n"""`)
  lines.push(
    `网页正文${page.truncated ? '（过长，已截取前面部分）' : ''}：\n"""\n${page.text || '（没有读取到正文）'}\n"""`,
  )
  return lines.join('\n')
}
