import type { SDKAssistantMessage, SDKMessage, SDKResultMessage, SDKSystemMessage } from '@anthropic-ai/claude-code'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources'
import type { ToolUseParams } from '../types'

// 清理工具结果内容
export function cleanToolResult(content: unknown): string {
  if (typeof content !== 'string') {
    return String(content)
  }

  // 检查是否包含 <tool_use_error> 标签
  const errorMatch = content.match(/<tool_use_error>([\s\S]*?)<\/tool_use_error>/)
  if (errorMatch) {
    return errorMatch[1].trim()
  }

  const targetPhrase = "Here's the result of running `cat -n` on a snippet of the edited file";
  const index = content.indexOf(targetPhrase);

  if (index > 0) {
    return content.substring(0, index).trim();
  }

  // 如果没有错误标签，返回原内容
  return content
}

export function extractTaggedContent(text: string) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<root>${text}</root>`, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return text;
    }

    const rootElement = doc.documentElement;
    if (rootElement.children.length > 0) {
      return rootElement.children[0].textContent || text;
    }

    return text;
  } catch {
    return text;
  }
}

// Bash 数据类型
export interface BashData {
  command: string
  description: string
  id: string
}

// TodoWrite 数据类型
export interface TodoWriteData {
  todos: Array<{
    content: string
    activeForm: string
    status: 'pending' | 'in_progress' | 'completed'
  }>
  id: string
}

// Write 数据类型
export interface WriteData {
  file_path: string
  content: string
  id: string
}

// 导出原有的数据提取函数
function is_assistant_msg(m: SDKMessage): m is SDKAssistantMessage {
  return m.type == "assistant"
}

export function extract_system_init(sdkMessage: SDKMessage): SDKSystemMessage | null {
  if (sdkMessage.type === 'system' && sdkMessage.subtype === 'init') {
    return sdkMessage
  }
  return null
}

export function extract_assistant_text(sdkMessage: SDKMessage): string | null {
  if (is_assistant_msg(sdkMessage)) {
    const content = sdkMessage.message.content
    const textContent = content[0]
    if (textContent.type == 'text') {
      return textContent.text
    }
  }
  return null
}

export function extract_claude_user_text(sdkMessage: SDKMessage): string | null {
  if (sdkMessage.type !== 'user') {
    return null
  }
  if (sdkMessage.message.role != "user") {
    return null
  }
  if (typeof sdkMessage.message.content != "string") {
    return null
  }
  return sdkMessage.message.content
}

export interface ToolUseBlock {
  id: string;
  tool_use: ToolUseParams
}

export interface UnkownToolUseBlock {
  id: string;
  tool_use: {
    tool_name: string
    input: unknown
  }
}

export interface McpToolUseBlock {
  id: string;
  tool_use: {
    tool_name: `mcp__${string}`
    input: unknown
  }
}

export function extract_mcp_tool_use(sdkMessage: SDKMessage): McpToolUseBlock | null {
  if (!is_assistant_msg(sdkMessage)) return null

  const content = sdkMessage.message.content[0]
  if (content.type != 'tool_use') {
    return null
  }

  // Check if tool name starts with "mcp__"
  if (!content.name.startsWith('mcp__')) {
    return null
  }

  return {
    id: content.id,
    tool_use: {
      tool_name: content.name as `mcp__${string}`,
      input: content.input
    }
  }
}

export function extract_unknown_tool_use(sdkMessage: SDKMessage): UnkownToolUseBlock | null {
  if (!is_assistant_msg(sdkMessage)) return null

  const content = sdkMessage.message.content[0]
  if (content.type != 'tool_use') {
    return null
  }

  // 类型安全的返回结构
  return {
    id: content.id,
    tool_use: {
      tool_name: content.name,
      input: content.input
    }
  }
}

export function extract_tool_use(sdkMessage: SDKMessage): ToolUseBlock | null {
  if (!is_assistant_msg(sdkMessage)) return null

  const content = sdkMessage.message.content[0]
  if (content.type != 'tool_use') {
    return null
  }

  // 定义所有有效的工具名称
  const validToolNames = [
    'Bash', 'Edit', 'Glob', 'Grep', 'MultiEdit', 'NotebookEdit',
    'Read', 'TodoWrite', 'WebFetch', 'WebSearch', 'Write',
    'Agent', 'BashOutput', 'ExitPlanMode', 'KillShell',
    'ListMcpResources', 'Mcp', 'ReadMcpResource'
  ]

  if (!validToolNames.includes(content.name)) {
    return null
  }

  // 类型安全的返回结构
  return {
    id: content.id,
    tool_use: {
      tool_name: content.name as ToolUseParams['tool_name'],
      input: content.input
    } as ToolUseParams
  }
}

export function extract_tool_result(sdkMessage: SDKMessage): ToolResultBlockParam | null {
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

export function extract_result(sdkMessage: SDKMessage): SDKResultMessage | null {
  if (sdkMessage.type == "result") {
    return sdkMessage
  }

  return null
}
