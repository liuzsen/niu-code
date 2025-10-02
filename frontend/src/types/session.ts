import type { SDKMessage } from '@anthropic-ai/claude-code'
import type { ClaudeSystemInfo, ToolPermissionRequest } from './message'
import type { PermissionResult } from '@anthropic-ai/claude-code'

// 严格对齐 backend/src/api/chat.rs UnifiedSessionInfo
export interface UnifiedSessionInfo {
  session_id: string
  last_user_input: string
  last_activity: string  // RFC3339
  is_active: boolean
}

// Legacy type - to be removed after full migration
export interface SessionInfo {
  cli_id: number
  work_dir: string
  created_at: string  // ISO timestamp
  last_activity: string
  message_count: number
  last_uesr_input: string | null  // 注意：后端拼写错误，前端也保持一致
}

// 严格对齐 backend/server/src/chat.rs:56-60
export interface MessageRecord {
  timestamp: string
  message: CacheMessage
}

// 严格对齐 backend/server/src/chat.rs:47-54
export type CacheMessage =
  | { UserInput: string }
  | { Claude: SDKMessage }
  | { SystemInfo: ClaudeSystemInfo }
  | { CanUseTool: ToolPermissionRequest }
  | { PermissionResp: PermissionResult }

// 辅助类型：用于区分 CacheMessage 的类型
export type CacheMessageType = keyof CacheMessage