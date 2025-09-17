import type { ClaudeMessage } from './claude';

export type SessionState = 'initializing' | 'active' | 'processing' | 'completed' | 'error';

export interface SessionConfig {
  cwd: string;
  permissionMode: 'default' | 'auto-allow' | 'deny';
  maxTurns: number;
  env: Record<string, string>;
  debug: boolean;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  updatedAt: string;
  state: SessionState;
  config: SessionConfig;
  messageCount: number;
  lastActivity: string;
}

export interface SessionMessage {
  id: string;
  claudeMessage: ClaudeMessage;
}

export interface Session {
  id: string;
  info: SessionInfo;
  messages: SessionMessage[];
  config: SessionConfig;
}

export interface CreateSessionOptions {
  sessionId?: string;
  config?: Partial<SessionConfig>;
}

export interface UpdateSessionOptions {
  state?: SessionState;
  config?: Partial<SessionConfig>;
}

export interface SessionFilter {
  state?: SessionState;
  createdAfter?: string;
  createdBefore?: string;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  errorSessions: number;
  averageMessageCount: number;
  totalMessages: number;
}

// Type guard functions
export function isSessionState(value: string): value is SessionState {
  return ['initializing', 'active', 'processing', 'completed', 'error'].includes(value);
}

export function isValidSessionConfig(config: Partial<SessionConfig>): config is Partial<SessionConfig> {
  return (
    config.cwd === undefined || typeof config.cwd === 'string' &&
    config.permissionMode === undefined || (typeof config.permissionMode === 'string' && ['default', 'auto-allow', 'deny'].includes(config.permissionMode)) &&
    config.maxTurns === undefined || typeof config.maxTurns === 'number' &&
    config.env === undefined || (typeof config.env === 'object' && config.env !== null) &&
    config.debug === undefined || typeof config.debug === 'boolean'
  );
}

// Helper functions
export function createDefaultSessionConfig(): SessionConfig {
  return {
    cwd: typeof window !== 'undefined' ? '/' : '',
    permissionMode: 'default',
    maxTurns: 100,
    env: {
      DEBUG: 'true'
    },
    debug: true
  };
}

export function createSessionInfo(sessionId: string, config: SessionConfig): SessionInfo {
  const now = new Date().toISOString();
  return {
    id: sessionId,
    createdAt: now,
    updatedAt: now,
    state: 'initializing',
    config,
    messageCount: 0,
    lastActivity: now
  };
}

export function updateSessionInfo(info: SessionInfo, updates: UpdateSessionOptions): SessionInfo {
  return {
    ...info,
    state: updates.state || info.state,
    config: updates.config ? { ...info.config, ...updates.config } : info.config,
    updatedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };
}

export function createSessionMessage(
  claudeMessage: ClaudeMessage
): SessionMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    claudeMessage
  };
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
}