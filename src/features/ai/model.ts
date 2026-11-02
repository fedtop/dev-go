/**
 * 对话模型的读取：划词 AI 动作与侧边栏助手共用。
 * 用户没单独配置对话模型时沿用翻译模型（同一个服务商通常两边都能用）。
 */
import { isLlmConfigReady, type LlmConfig } from '@/features/translate/llm-config'
import {
  assistantLlmApiKey,
  assistantLlmConfig,
  translateLlmApiKey,
  translateLlmConfig,
} from '@/utils/settings'

export interface ChatModel {
  config: LlmConfig
  apiKey: string
  /** 是否沿用翻译模型（界面提示用） */
  inherited: boolean
}

/** 由已读取的存储值推导实际使用的对话模型（React 侧与后台共用同一规则） */
export function resolveChatModel(
  assistantConfig: LlmConfig | null,
  assistantKey: string,
  translateConfig: LlmConfig,
  translateKey: string,
): ChatModel {
  return assistantConfig
    ? { config: assistantConfig, apiKey: assistantKey, inherited: false }
    : { config: translateConfig, apiKey: translateKey, inherited: true }
}

export async function readChatModel(): Promise<ChatModel> {
  const [assistantConfig, assistantKey, translateConfig, translateKey] = await Promise.all([
    assistantLlmConfig.getValue(),
    assistantLlmApiKey.getValue(),
    translateLlmConfig.getValue(),
    translateLlmApiKey.getValue(),
  ])
  return resolveChatModel(assistantConfig, assistantKey, translateConfig, translateKey)
}

export async function isChatModelReady(): Promise<boolean> {
  return isLlmConfigReady((await readChatModel()).config)
}
