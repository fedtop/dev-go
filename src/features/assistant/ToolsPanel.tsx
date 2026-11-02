import { useState } from 'react'

import Button from '@/ui/Button'
import type { WebmcpExecuteResult } from '@/utils/messaging'

import { templateFromSchema } from './schema-template'
import type { FrameTool, ToolsStatus } from './webmcp-client'

interface ToolsPanelProps {
  tools: FrameTool[]
  status: ToolsStatus
  onRefresh: () => void
  execute: (tool: FrameTool, args: unknown) => Promise<WebmcpExecuteResult>
}

const toolKey = (tool: FrameTool) => `${tool.frameId}:${tool.name}`

/** 网页工具列表：查看说明与参数 Schema，手动填参数执行（调试网页的 WebMCP 实现时很有用） */
export default function ToolsPanel({ tools, status, onRefresh, execute }: ToolsPanelProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <section className='shrink-0 border-b border-slate-200/70'>
      <div className='flex items-center justify-between px-3 py-1.5'>
        <button
          type='button'
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className='flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-indigo-600'
        >
          <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
          网页工具
          <span className='text-slate-400'>
            {status === 'ready' ? `（${tools.length}）` : status === 'loading' ? '（读取中）' : ''}
          </span>
        </button>
        <button
          type='button'
          onClick={onRefresh}
          className='text-[11px] text-slate-400 hover:text-indigo-600'
        >
          刷新
        </button>
      </div>

      {open && (
        <div className='max-h-[45vh] overflow-y-auto px-3 pb-2'>
          {tools.length === 0 ? (
            <p className='py-2 text-xs text-slate-400'>
              {status === 'ready' ? '当前网页没有注册工具' : '暂无可用工具'}
            </p>
          ) : (
            <ul className='flex flex-col gap-1.5'>
              {tools.map((tool) => (
                <ToolRow
                  key={toolKey(tool)}
                  tool={tool}
                  expanded={selected === toolKey(tool)}
                  onToggle={() =>
                    setSelected((current) => (current === toolKey(tool) ? null : toolKey(tool)))
                  }
                  execute={execute}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function ToolRow({
  tool,
  expanded,
  onToggle,
  execute,
}: {
  tool: FrameTool
  expanded: boolean
  onToggle: () => void
  execute: ToolsPanelProps['execute']
}) {
  const [args, setArgs] = useState(() =>
    JSON.stringify(templateFromSchema(tool.inputSchema) ?? {}, null, 2),
  )
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<{ ok: boolean; text: string } | null>(null)

  const run = async () => {
    let parsed: unknown
    try {
      parsed = args.trim() ? JSON.parse(args) : {}
    } catch {
      setOutput({ ok: false, text: '参数不是合法的 JSON' })
      return
    }
    setRunning(true)
    setOutput(null)
    const result = await execute(tool, parsed)
    setOutput(
      result.ok
        ? { ok: true, text: result.result ?? '（执行成功，没有返回值）' }
        : { ok: false, text: result.error ?? '执行失败' },
    )
    setRunning(false)
  }

  return (
    <li className='rounded-lg border border-slate-200 bg-white text-xs shadow-sm'>
      <button
        type='button'
        onClick={onToggle}
        className='flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left'
      >
        <span className='flex items-center gap-1.5'>
          <span className='truncate font-mono font-medium text-slate-700'>{tool.name}</span>
          {tool.readOnly && (
            <span className='shrink-0 rounded bg-emerald-50 px-1 text-[10px] text-emerald-600'>
              只读
            </span>
          )}
          {tool.frameId !== 0 && (
            <span className='shrink-0 rounded bg-slate-100 px-1 text-[10px] text-slate-500'>
              iframe
            </span>
          )}
        </span>
        {tool.description && (
          <span className='line-clamp-2 text-[11px] leading-snug text-slate-400'>
            {tool.description}
          </span>
        )}
      </button>

      {expanded && (
        <div className='flex flex-col gap-1.5 border-t border-slate-100 px-2.5 py-2'>
          <label
            className='text-[11px] text-slate-400'
            htmlFor={`args-${tool.frameId}-${tool.name}`}
          >
            参数（JSON）
          </label>
          <textarea
            id={`args-${tool.frameId}-${tool.name}`}
            value={args}
            rows={Math.min(8, Math.max(2, args.split('\n').length))}
            spellCheck={false}
            onChange={(event) => setArgs(event.target.value)}
            className='popup-field w-full resize-y rounded-md border px-2 py-1.5 font-mono text-[11px] text-slate-700 outline-none'
          />
          <div className='flex items-center gap-2'>
            <Button
              variant='primary'
              onClick={() => void run()}
              loading={running}
              className='!px-2 !py-0.5 text-xs'
            >
              执行
            </Button>
            {!tool.readOnly && (
              <span className='text-[10px] text-amber-600'>未声明只读，可能修改网页数据</span>
            )}
          </div>
          {output && (
            <pre
              className={`max-h-40 overflow-auto rounded p-1.5 font-mono text-[11px] whitespace-pre-wrap break-all ${
                output.ok ? 'bg-slate-50 text-slate-600' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {output.text}
            </pre>
          )}
        </div>
      )}
    </li>
  )
}
