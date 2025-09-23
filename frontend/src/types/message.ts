import type { ModelInfo, PermissionMode, PermissionResult, PermissionUpdate, SDKMessage, SlashCommand } from '@anthropic-ai/claude-code';
export type { PermissionUpdate }
import type { ToolInputSchemas } from './sdk-tools';

export type ChatId = string;

export interface ClientMessage {
    chat_id: ChatId;
    data: ClientMessageData;
}

export type ClientMessageData =
    | UserInput
    | { kind: 'permission_resp' } & PermissionResult
    | { kind: 'set_mode' } & PermissionMode
    | { kind: 'get_info' };

export interface UserInput {
    kind: 'user_input',
    content: string,
    resume?: string
}

export interface ServerMessage {
    chat_id: ChatId;
    data: ServerMessageData;
}

export type ServerMessageData =
    | { kind: 'claude' } & SDKMessage
    | { kind: 'server_error'; error: string }
    | { kind: 'system_info'; commands: SlashCommand[]; models: ModelInfo[] }
    | { kind: 'can_use_tool'; tool_name: string; input: ToolInputSchemas; tool_use_id: string; suggestions?: PermissionUpdate[] };

// 扩展的类型定义
export interface WebSocketError {
    type: 'parse_error' | 'connection_error' | 'network_error'
    error: Error
    rawMessage?: string
}

export interface ToolPermissionRequest {
    tool_name: string
    tool_use_id: string
    input: ToolInputSchemas
    suggestions?: PermissionUpdate[]
    chat_id: string
}

export interface ExtendedPermissionResult {
    tool_use_id: string
    allowed: boolean
    remember?: boolean
    suggestion?: PermissionUpdate
}

// 聊天消息类型
export interface ChatMessage {
    chat_id: string
    data: ChatMessageData
}

export type ChatMessageData =
    | { from: 'human'; content: UserInput }
    | { from: 'agent'; content: SDKMessage }
