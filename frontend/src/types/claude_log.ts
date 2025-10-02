import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs"

export interface ClaudeSession {
  logs: ClaudeLogTypes[]
}

export interface LoadSessionOptions {
  workDir: string
  limit: number
  maxAge: number // milliseconds
}

export interface ClaudeLog {
  parentUuid?: string
  isSidechain: boolean
  userType: string
  cwd: string
  sessionId: string
  version: string
  gitBranch?: string
  message: BetaMessage
  isMeta?: boolean
  uuid: string
  timestamp: string
  thinkingMetadata?: Record<string, unknown>
  toolUseResult?: Record<string, unknown>
}

export type ClaudeLogMessage =
  | BetaMessage
  | { role: "user", content: string }

export interface ClaudeSummary {
  summary: string
  leafUuid?: string
}

export type ClaudeLogTypes =
  | { type: 'user'; data: ClaudeLog }
  | { type: 'assistant'; data: ClaudeLog }
  | { type: 'summary'; data: ClaudeSummary }