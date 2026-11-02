import { SELECTION_AI_ACTIONS } from '@/features/ai/actions'
import Switch from '@/ui/Switch'
import { enableSelectionTranslate, selectionAiEnabled } from '@/utils/settings'
import { useStorageItem } from '@/utils/useStorageItem'

import { Card, Row, SectionHeader } from './layout'

/** 设置页：划词 */
export default function SelectionSettings() {
  const [enabled, setEnabled] = useStorageItem(enableSelectionTranslate)
  const [aiEnabled, setAiEnabled] = useStorageItem(selectionAiEnabled)

  return (
    <div className='flex flex-col gap-5'>
      <SectionHeader title='划词' desc='在网页上选中文字后弹出的工具条' />

      <Card title='划词工具条'>
        <Row label='启用划词' hint='选中网页文字后在旁边显示工具条；单个英文单词同时显示词典释义'>
          <Switch checked={enabled} onChange={setEnabled} />
        </Row>
        <Row
          label='AI 动作'
          hint='需要配置可用的对话模型（未单独配置时沿用翻译模型）；关闭后只保留翻译'
        >
          <Switch checked={aiEnabled} onChange={setAiEnabled} disabled={!enabled} />
        </Row>
      </Card>

      <Card
        title='AI 动作说明'
        desc='结果在气泡里流式显示，可以复制，也可以「继续追问」带到侧边栏 AI 助手接着聊。'
      >
        <ul className='flex flex-col gap-2 text-sm text-slate-600'>
          <li>
            <b>翻译</b>：使用翻译设置里的引擎（谷歌 / 微软 / 翻译模型）。
          </li>
          <li>
            <b>{SELECTION_AI_ACTIONS.explain.label}</b>：{SELECTION_AI_ACTIONS.explain.title}
            ，会附带选区所在段落和网页标题，缩写、术语按文章语境解释。
          </li>
          <li>
            <b>{SELECTION_AI_ACTIONS.summarize.label}</b>：{SELECTION_AI_ACTIONS.summarize.title}。
          </li>
          <li>
            <b>问 AI</b>：打开侧边栏，带着选中内容提问。
          </li>
          <li>
            <b>输入框内</b>：选中自己写的文字时提供「{SELECTION_AI_ACTIONS.polish.label}」「
            {SELECTION_AI_ACTIONS.fix.label}」「{SELECTION_AI_ACTIONS.formal.label}
            」，结果可一键替换原文（支持撤销）。
          </li>
        </ul>
      </Card>
    </div>
  )
}
