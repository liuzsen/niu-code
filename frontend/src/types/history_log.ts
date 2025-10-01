import type { SDKUserMessage, SDKAssistantMessage } from "@anthropic-ai/claude-code";

export type HistoryLogType = "system" | "user" | "assistant" | "summary";

export type HistoryLogBase = {
    "parentUuid": string | null,
    "isSidechain": boolean,
    "userType": string,
    "cwd": string,
    "sessionId": string,
    "version": string,
    "gitBranch"?: string,
    "uuid": string,
    "timestamp": string,
}

export type UserHistoryLog = HistoryLogBase & SDKUserMessage

export type AssistantHistoryLog = HistoryLogBase & SDKAssistantMessage

export type HistoryLog = UserHistoryLog | AssistantHistoryLog

// 对应后端的 ClaudeSessionInfo
export interface ClaudeSessionInfo {
    session_id: string,
    last_user_input: string,
    last_active: string, // ISO datetime string
}

// 对应后端的 ClaudeSession
export interface ClaudeSession {
    logs: HistoryLog[]
}