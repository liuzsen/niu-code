import type { SDKMessage } from '@anthropic-ai/claude-code'
import type { MessageParam } from '@anthropic-ai/sdk/resources'
import type { ClaudeSystemInfo, ToolPermissionRequest } from './message'
import type { PermissionResult } from '@anthropic-ai/claude-code'

// 严格对齐 backend/src/api/chat.rs UnifiedSessionInfo
export interface UnifiedSessionInfo {
  session_id: string
  last_user_input: string
  last_activity: string  // RFC3339
  is_active: boolean
}

// 严格对齐 backend/server/src/chat.rs:56-60
export interface MessageRecord {
  timestamp: string
  message: CacheMessage
}

// 严格对齐 backend/server/src/chat.rs:47-54
export type CacheMessage =
  | { UserInput: MessageParam }
  | { Claude: SDKMessage }
  | { SystemInfo: ClaudeSystemInfo }
  | { CanUseTool: ToolPermissionRequest }
  | { PermissionResp: PermissionResult }
