import type { ReactNode } from 'react'

/**
 * 轻量 Markdown 渲染：覆盖 AI 回答常见的标题、列表、引用、代码块与行内格式。
 * 直接生成 React 元素，不使用 innerHTML —— 模型输出可能夹带网页里的任意文本。
 * 流式输出时未闭合的代码块按已收到的部分渲染。
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; start: number; items: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'rule' }

const LIST_ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    const fence = /^\s*(```|~~~)\s*([\w+-]*)/.exec(line)
    if (fence) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith(fence[1])) {
        code.push(lines[index])
        index += 1
      }
      index += 1
      blocks.push({ kind: 'code', lang: fence[2], code: code.join('\n') })
      continue
    }

    if (!line.trim()) {
      index += 1
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
      index += 1
      continue
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ kind: 'rule' })
      index += 1
      continue
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      blocks.push({ kind: 'quote', lines: quote })
      continue
    }

    const item = LIST_ITEM.exec(line)
    if (item) {
      const ordered = Boolean(item[2])
      const list: Block = {
        kind: 'list',
        ordered,
        start: ordered ? Number(item[2]) : 1,
        items: [],
      }
      while (index < lines.length) {
        const current = LIST_ITEM.exec(lines[index])
        if (current && Boolean(current[2]) === ordered) {
          list.items.push(current[3])
        } else if (lines[index].trim() && /^\s{2,}/.test(lines[index]) && list.items.length) {
          // 缩进的续行 / 子项并入上一项
          list.items[list.items.length - 1] += `\n${lines[index].trim()}`
        } else {
          break
        }
        index += 1
      }
      blocks.push(list)
      continue
    }

    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s|^\s*(```|~~~|>)/.test(lines[index]) &&
      !LIST_ITEM.test(lines[index])
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push({ kind: 'paragraph', lines: paragraph })
  }

  return blocks
}

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\s][^*\n]*\*)|(\[[^\]\n]+\]\([^)\s]+\))/

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  let key = 0

  while (rest) {
    const match = INLINE.exec(rest)
    if (!match) {
      nodes.push(rest)
      break
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index))
    const token = match[0]
    const id = `${keyPrefix}-${(key += 1)}`

    if (match[1]) {
      nodes.push(
        <code key={id} className='md-code-inline'>
          {token.slice(1, -1)}
        </code>,
      )
    } else if (match[2]) {
      nodes.push(<strong key={id}>{renderInline(token.slice(2, -2), id)}</strong>)
    } else if (match[3]) {
      nodes.push(<em key={id}>{renderInline(token.slice(1, -1), id)}</em>)
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      const href = link?.[2] ?? ''
      nodes.push(
        /^https?:\/\//i.test(href) ? (
          <a key={id} href={href} target='_blank' rel='noreferrer noopener' className='md-link'>
            {link?.[1]}
          </a>
        ) : (
          link?.[1]
        ),
      )
    }
    rest = rest.slice(match.index + token.length)
  }

  return nodes
}

function renderLines(lines: string[], keyPrefix: string): ReactNode[] {
  return lines.flatMap((line, index) => [
    ...(index ? [<br key={`${keyPrefix}-br-${index}`} />] : []),
    ...renderInline(line, `${keyPrefix}-${index}`),
  ])
}

export default function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const blocks = parseBlocks(text)

  return (
    <div className={`md ${className}`}>
      {blocks.map((block, index) => {
        const key = `b${index}`
        switch (block.kind) {
          case 'heading':
            return (
              <p key={key} className={`md-heading md-h${Math.min(block.level, 3)}`}>
                {renderInline(block.text, key)}
              </p>
            )
          case 'paragraph':
            return <p key={key}>{renderLines(block.lines, key)}</p>
          case 'quote':
            return (
              <blockquote key={key} className='md-quote'>
                {renderLines(block.lines, key)}
              </blockquote>
            )
          case 'code':
            return (
              <pre key={key} className='md-code'>
                <code>{block.code}</code>
              </pre>
            )
          case 'rule':
            return <hr key={key} className='md-rule' />
          case 'list': {
            const items = block.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`}>
                {renderLines(item.split('\n'), `${key}-${itemIndex}`)}
              </li>
            ))
            return block.ordered ? (
              <ol key={key} start={block.start} className='md-list md-ordered'>
                {items}
              </ol>
            ) : (
              <ul key={key} className='md-list'>
                {items}
              </ul>
            )
          }
        }
      })}
    </div>
  )
}
