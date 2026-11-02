/**
 * 划词 AI 动作：按动作拼装提示词。在后台执行（见 background/ai.ts），内容脚本只传动作和文本。
 *
 * 与只发送选中文字的做法相比，这里附带选区所在段落与网页标题：解释缩写、术语时
 * 模型能结合上下文给出它在这篇文章里的含义。
 */
import type { ChatMessage } from '@/api/llm'

/** 阅读类动作：结果展示在气泡里 */
export type ReadAction = 'explain' | 'summarize'
/** 写作类动作（输入框内选中文字时）：结果可一键替换原文 */
export type WriteAction = 'polish' | 'fix' | 'formal'
export type SelectionAiAction = ReadAction | WriteAction

export const SELECTION_AI_ACTIONS: Record<SelectionAiAction, { label: string; title: string }> = {
  explain: { label: '解释', title: '结合上下文解释选中内容' },
  summarize: { label: '总结', title: '提炼选中内容的要点' },
  polish: { label: '润色', title: '让表达更通顺自然' },
  fix: { label: '纠错', title: '修正错别字、语法和标点' },
  formal: { label: '正式', title: '改写成更正式的书面语' },
}

export const READ_ACTIONS: ReadAction[] = ['explain', 'summarize']
export const WRITE_ACTIONS: WriteAction[] = ['polish', 'fix', 'formal']

export function isWriteAction(action: SelectionAiAction): action is WriteAction {
  return (WRITE_ACTIONS as string[]).includes(action)
}

/** 选区的上下文（都可为空） */
export interface SelectionContext {
  /** 选区所在的段落（已截断） */
  paragraph?: string
  title?: string
  url?: string
}

const WRITE_INSTRUCTIONS: Record<WriteAction, string> = {
  polish: '润色下面的文字：让表达更通顺、自然、简洁，保持原意、语气和语言不变。',
  fix: '修正下面文字中的错别字、语法和标点错误，除错误外不做任何改动，保持原文语言。',
  formal: '把下面的文字改写成正式、礼貌、专业的书面语，保持原意和原文语言。',
}

function describeContext(context: SelectionContext): string {
  const lines: string[] = []
  if (context.title) lines.push(`网页标题：${context.title}`)
  if (context.url) lines.push(`网页地址：${context.url}`)
  if (context.paragraph) lines.push(`选中内容所在段落：\n"""\n${context.paragraph}\n"""`)
  return lines.join('\n')
}

export function buildSelectionMessages(
  action: SelectionAiAction,
  text: string,
  context: SelectionContext,
): ChatMessage[] {
  if (isWriteAction(action)) {
    return [
      {
        role: 'system',
        content: `${WRITE_INSTRUCTIONS[action]}\n只输出改写后的文字本身，不要解释、不要加引号或前后缀。`,
      },
      { role: 'user', content: text },
    ]
  }

  const contextText = describeContext(context)
  const task =
    action === 'explain'
      ? '解释用户选中的内容：先用一两句话说清它是什么意思，再按需补充背景、用法或例子。' +
        '如果是缩写、术语或代码，结合上下文说明它在这里的具体含义。'
      : '用简洁的要点总结用户选中的内容，突出关键信息，不要逐句复述。'
  return [
    {
      role: 'system',
      content:
        `你是浏览器划词助手。${task}\n` +
        '回答使用简体中文（选中内容本身是中文且用户另有要求时除外），可以使用 Markdown，篇幅尽量精炼。',
    },
    {
      role: 'user',
      content: `${contextText ? `${contextText}\n\n` : ''}选中的内容：\n"""\n${text}\n"""`,
    },
  ]
}
