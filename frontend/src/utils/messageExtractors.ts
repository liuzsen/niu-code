import type { SDKAssistantMessage, SDKMessage, SDKResultMessage, SDKSystemMessage } from '@anthropic-ai/claude-code'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources'

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

  // 如果没有错误标签，返回原内容
  return content
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

export function extract_bash(sdkMessage: SDKMessage): BashData | null {
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

export function extract_todo_write(sdkMessage: SDKMessage): TodoWriteData | null {
  if (!is_assistant_msg(sdkMessage)) return null

  const content = sdkMessage.message.content[0]
  if (content.type != 'tool_use') {
    return null
  }

  if (content.name != 'TodoWrite') {
    return null
  }

  const input = content.input;
  if (!input || typeof input != "object") {
    return null
  }

  if (
    'todos' in input &&
    Array.isArray(input.todos) &&
    input.todos.every((todo: { content: string; activeForm: string; status: string }) =>
      todo.content && todo.activeForm && todo.status
    )
  ) {
    return {
      todos: input.todos,
      id: content.id
    }
  }

  return null
}

export function extract_write(sdkMessage: SDKMessage): WriteData | null {
  if (!is_assistant_msg(sdkMessage)) return null

  const content = sdkMessage.message.content[0]
  if (content.type != 'tool_use') {
    return null
  }

  if (content.name != 'Write') {
    return null
  }

  const input = content.input;
  if (!input || typeof input != "object") {
    return null
  }

  if (
    'file_path' in input &&
    'content' in input &&
    typeof input.file_path === 'string' &&
    typeof input.content === 'string'
  ) {
    return {
      file_path: input.file_path,
      content: input.content,
      id: content.id
    }
  }

  return null

}


export interface ClaudeEdit {
  old_string: string,
  new_string: string,
  replace_all?: boolean
}

export interface MultiEditData {
  file_path: string
  edits: ClaudeEdit[]
  id: string
}

// Read 数据类型
export interface ReadData {
  file_path: string
  id: string
}

export function extract_read(sdkMessage: SDKMessage): ReadData | null {
  if (!is_assistant_msg(sdkMessage)) return null

  const content = sdkMessage.message.content[0]
  if (content.type != 'tool_use') {
    return null
  }

  if (content.name != 'Read') {
    return null
  }

  const input = content.input;
  if (!input || typeof input != "object") {
    return null
  }

  if (
    'file_path' in input &&
    typeof input.file_path === 'string'
  ) {
    return {
      file_path: input.file_path,
      id: content.id
    }
  }

  return null
}

export function extract_multi_edit(sdkMessage: SDKMessage): MultiEditData | null {
  if (!is_assistant_msg(sdkMessage)) return null

  const content = sdkMessage.message.content[0]
  if (content.type != 'tool_use') {
    return null
  }

  if (content.name != 'MultiEdit') {
    return null
  }

  const input = content.input;
  if (!input || typeof input != "object") {
    return null
  }

  if (
    'file_path' in input &&
    'edits' in input &&
    typeof input.file_path === 'string' &&
    Array.isArray(input.edits) &&
    input.edits.every((edit: { old_string: string; new_string: string; replace_all?: boolean }) =>
      typeof edit.old_string === 'string' &&
      typeof edit.new_string === 'string' &&
      (edit.replace_all === undefined || typeof edit.replace_all === 'boolean')
    )
  ) {
    return {
      file_path: input.file_path,
      edits: input.edits,
      id: content.id
    }
  }

  return null
}

export interface EditData {
  file_path: string,
  old_string: string,
  new_string: string,
  id: string
}

export function extract_edit(sdkMessage: SDKMessage): EditData | null {
  if (!is_assistant_msg(sdkMessage)) return null

  const content = sdkMessage.message.content[0]
  if (content.type != 'tool_use') {
    return null
  }

  if (content.name != 'Edit') {
    return null
  }

  const input = content.input;
  if (!input || typeof input != "object") {
    return null
  }

  if (
    'file_path' in input &&
    'old_string' in input &&
    'new_string' in input &&
    typeof input.file_path === 'string' &&
    typeof input.old_string === 'string' &&
    typeof input.new_string === 'string'
  ) {
    return {
      file_path: input.file_path,
      old_string: input.old_string,
      new_string: input.new_string,
      id: content.id
    }
  }

  return null
}

export function extract_result(sdkMessage: SDKMessage): SDKResultMessage | null {
  if (sdkMessage.type == "result") {
    return sdkMessage
  }

  return null
}