import type { ModelInfo, PermissionMode, PermissionResult, PermissionUpdate, SDKMessage, SlashCommand } from '@anthropic-ai/claude-code';
export type { PermissionUpdate }
import type { AgentInput, BashInput, BashOutputInput, ExitPlanModeInput, FileEditInput, FileMultiEditInput, FileReadInput, FileWriteInput, GlobInput, GrepInput, KillShellInput, ListMcpResourcesInput, McpInput, NotebookEditInput, ReadMcpResourceInput, TodoWriteInput, WebFetchInput, WebSearchInput } from './sdk-tools';

export type ChatId = string;

export interface ClientMessage {
    chat_id: ChatId;
    data: ClientMessageData;
}

export type ClientMessageData =
    | { kind: "register_chat" }
    | { kind: "user_input" } & UserInput
    | { kind: 'permission_resp' } & PermissionResult
    | { kind: 'set_mode', mode: PermissionMode }
    | { kind: 'get_info' }
    | { kind: 'stop' }

// StartChatOptions moved to HTTP API, no longer used in WebSocket messages

export interface UserInput {
    content: string,
}

export interface ServerMessage {
    chat_id: ChatId;
    data: ServerMessageData;
}

export type ServerMessageData =
    | { kind: 'claude' } & SDKMessage
    | { kind: 'server_error', error: string }
    | { kind: 'system_info' } & ClaudeSystemInfo
    | { kind: 'can_use_tool' } & ToolPermissionRequest
    | { kind: 'chat_subscribed_by_others' }

export interface ClaudeSystemInfo {
    commands: SlashCommand[],
    models: ModelInfo[]
}

export interface ToolPermissionRequest {
    suggestions?: PermissionUpdate[],
    tool_use: ToolUse
}

export type ToolUse = | {
    tool_name: "Bash"
    input: BashInput
} | {
    tool_name: "Edit"
    input: FileEditInput
} | {
    tool_name: "Glob",
    input: GlobInput
} | {
    tool_name: "Grep"
    input: GrepInput
} | {
    tool_name: "MultiEdit"
    input: FileMultiEditInput
} | {
    tool_name: "NotebookEdit"
    input: NotebookEditInput
} | {
    tool_name: "Read"
    input: FileReadInput
} | {
    tool_name: "TodoWrite"
    input: TodoWriteInput
} | {
    tool_name: "WebFetch"
    input: WebFetchInput
} | {
    tool_name: "WebSearch"
    input: WebSearchInput
} | {
    tool_name: "Write"
    input: FileWriteInput
} | {
    tool_name: "Agent"
    input: AgentInput
} | {
    tool_name: "BashOutput"
    input: BashOutputInput
} | {
    tool_name: "ExitPlanMode"
    input: ExitPlanModeInput
} | {
    tool_name: "KillShell"
    input: KillShellInput
} | {
    tool_name: "ListMcpResources"
    input: ListMcpResourcesInput
} | {
    tool_name: "Mcp"
    input: McpInput
} | {
    tool_name: "ReadMcpResource"
    input: ReadMcpResourceInput
} | {
    tool_name: `mcp__${string}`,
    input: unknown
}

