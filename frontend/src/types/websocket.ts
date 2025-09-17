import type { ProjectClaudeMessage } from './claude';
import type { ToolPermissionRequest, ToolPermissionResponse } from './index';

// Client message types

export interface UserInputData {
  content: string;
  sessionId?: string;
}

export interface ToolPermissionResponseData extends ToolPermissionResponse {
  sessionId: string;
  toolRequestId?: string;
}

export interface StartSessionData {
  sessionId?: string;
  config?: {
    cwd?: string;
    permissionMode?: 'default' | 'auto-allow' | 'deny';
  };
}

export interface UserInputMessage {
  type: 'user_input';
  data: UserInputData;
}

export interface ToolPermissionResponseMessage {
  type: 'tool_permission_response';
  data: ToolPermissionResponseData;
}

export interface StartSessionMessage {
  type: 'start_session';
  data: StartSessionData;
}

// Union type for all client messages
export type ClientMessage =
  | UserInputMessage
  | ToolPermissionResponseMessage
  | StartSessionMessage;

// Server message types

export interface ToolPermissionRequestData extends ToolPermissionRequest {
  sessionId: string;
  requestId: string;
  suggestions?: Record<string, unknown>;
}

export interface ErrorData {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  sessionId?: string;
}

export interface SessionStartedData {
  sessionId: string;
  message: string;
  timestamp: string;
}

export interface ClaudeMessageWrapper {
  type: 'claude_message';
  data: ProjectClaudeMessage;
}

export interface ToolPermissionRequestWrapper {
  type: 'tool_permission_request';
  data: ToolPermissionRequestData;
}

export interface ErrorMessageWrapper {
  type: 'error';
  data: ErrorData;
}

export interface SessionStartedWrapper {
  type: 'session_started';
  data: SessionStartedData;
}

// Union type for all server messages
export type ServerMessage =
  | ClaudeMessageWrapper
  | ToolPermissionRequestWrapper
  | ErrorMessageWrapper
  | SessionStartedWrapper;

// Type guard functions for client messages
export function isUserInputMessage(message: ClientMessage): message is UserInputMessage {
  return message.type === 'user_input';
}

export function isToolPermissionResponseMessage(message: ClientMessage): message is ToolPermissionResponseMessage {
  return message.type === 'tool_permission_response';
}

export function isStartSessionMessage(message: ClientMessage): message is StartSessionMessage {
  return message.type === 'start_session';
}

// Type guard functions for server messages
export function isClaudeMessageWrapper(message: ServerMessage): message is ClaudeMessageWrapper {
  return message.type === 'claude_message';
}

export function isToolPermissionRequestWrapper(message: ServerMessage): message is ToolPermissionRequestWrapper {
  return message.type === 'tool_permission_request';
}

export function isErrorMessageWrapper(message: ServerMessage): message is ErrorMessageWrapper {
  return message.type === 'error';
}

export function isSessionStartedWrapper(message: ServerMessage): message is SessionStartedWrapper {
  return message.type === 'session_started';
}

// Helper functions for creating messages
export function createUserInputMessage(content: string, sessionId?: string): UserInputMessage {
  return {
    type: 'user_input',
    data: { content, sessionId }
  };
}

export function createToolPermissionResponseMessage(
  response: ToolPermissionResponse,
  sessionId: string,
  toolRequestId?: string
): ToolPermissionResponseMessage {
  return {
    type: 'tool_permission_response',
    data: { ...response, sessionId, toolRequestId }
  };
}

export function createStartSessionMessage(sessionId?: string, config?: StartSessionData['config']): StartSessionMessage {
  return {
    type: 'start_session',
    data: { sessionId, config }
  };
}

export function createClaudeMessageWrapper(
  message: ProjectClaudeMessage
): ClaudeMessageWrapper {
  return {
    type: 'claude_message',
    data: message
  };
}

export function createToolPermissionRequestWrapper(
  request: ToolPermissionRequest,
  sessionId: string,
  requestId: string
): ToolPermissionRequestWrapper {
  return {
    type: 'tool_permission_request',
    data: {
      ...request,
      sessionId,
      requestId
    }
  };
}

export function createErrorMessageWrapper(
  message: string,
  sessionId?: string,
  code?: string,
  details?: Record<string, unknown>
): ErrorMessageWrapper {
  return {
    type: 'error',
    data: {
      message,
      code,
      details,
      sessionId
    }
  };
}

export function createSessionStartedWrapper(sessionId: string, message: string): SessionStartedWrapper {
  return {
    type: 'session_started',
    data: {
      sessionId,
      message,
      timestamp: new Date().toISOString()
    }
  };
}