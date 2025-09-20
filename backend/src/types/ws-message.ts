import { SDKMessage } from '@anthropic-ai/claude-code';

// Client message types
export interface UserInputMessage {
  type: 'user_input';
  content: string;
  sessionId?: string;
}

// Union type for all client messages
export type ClientMessage = UserInputMessage

// Union type for all server messages
export type ServerMessage =
  | ClaudeMessageWrapper
  | WsErrorMessage

export interface ClaudeMessageWrapper {
  type: 'claude_message',
  // 原始 SDK 消息
  sdkMessage: SDKMessage,
  receivedAt: string,
  index: number,
}

export interface WsErrorMessage {
  type: 'error';
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  sessionId?: string;
}

export function createClaudeMessageWrapper(
  index: number,
  sdkMessage: SDKMessage
): ClaudeMessageWrapper {
  const now = new Date().toISOString();
  return {
    type: 'claude_message',
    sdkMessage,
    receivedAt: now,
    index,
  };
}

export function createWsErrorMessage(
  message: string,
  sessionId?: string,
  code?: string,
  details?: Record<string, unknown>
): WsErrorMessage {
  return {
    type: 'error',
    message,
    code,
    details,
    sessionId
  };
}
