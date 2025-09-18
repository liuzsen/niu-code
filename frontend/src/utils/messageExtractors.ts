import type { ProjectClaudeMessage } from '../types/claude'
import type { SDKAssistantMessage, SDKMessage, SDKSystemMessage } from '@anthropic-ai/claude-code'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources'

// Bash 数据类型
export interface BashData {
  command: string
  description: string
  id: string
}

// 导出原有的数据提取函数
function is_assistant_msg(m: SDKMessage): m is SDKAssistantMessage {
  return m.type == "assistant"
}

export function extract_system_init(message: ProjectClaudeMessage): SDKSystemMessage | null {
  const sdkMessage = message.sdkMessage
  if (sdkMessage.type === 'system' && sdkMessage.subtype === 'init') {
    return sdkMessage
  }
  return null
}

export function extract_assistant_text(message: ProjectClaudeMessage): string | null {
  const sdkMessage = message.sdkMessage
  if (is_assistant_msg(sdkMessage)) {
    const content = sdkMessage.message.content
    const textContent = content[0]
    if (textContent.type == 'text') {
      return textContent.text
    }
  }
  return null
}

export function extract_bash(message: ProjectClaudeMessage): BashData | null {
  const sdkMessage = message.sdkMessage

  if (!is_assistant_msg(sdkMessage)) return null

  const content = sdkMessage.message.content[0]
  if (content.type != 'tool_use') {
    return null
  }

  const input = content.input;
  if (!input || typeof input != "object") {
    return null
  }

  if (
    'command' in input &&
    'description' in input &&
    typeof input.command === 'string' &&
    typeof input.description === 'string'
  ) {
    return {
      command: input.command,
      description: input.description,
      id: content.id
    }
  }

  return null
}

export function extract_tool_result(message: ProjectClaudeMessage): ToolResultBlockParam | null {
  const sdkMessage = message.sdkMessage

  if (sdkMessage.type !== 'user') {
    return null
  }
  if (sdkMessage.message.role != "user") {
    return null
  }

  if (typeof sdkMessage.message.content == "string") {
    return null
  }

  const content = sdkMessage.message.content[0]

  if (content.type != "tool_result") {
    return null
  }

  return content
}