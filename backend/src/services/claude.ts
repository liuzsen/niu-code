import { query, SDKUserMessage, PermissionMode } from '@anthropic-ai/claude-code';
import { ProjectClaudeMessage, createProjectClaudeMessage } from '../types/claude.js';
import { ServerMessage, createClaudeMessageWrapper } from '../types/websocket.js';
import { Session, SessionInfo, SessionConfig, createSessionInfo, createSessionMessage, generateSessionId } from '../types/session.js';

export interface ClaudeServiceOptions {
  cwd?: string;
  permissionMode?: PermissionMode;
  maxTurns?: number;
  env?: Record<string, string>;
  debug?: boolean;
}

export interface SessionResult {
  sessionId: string;
  messages: ProjectClaudeMessage[];
  result?: ProjectClaudeMessage;
  error?: string;
}

export class ClaudeService {
  private activeSessions: Map<string, Session> = new Map();

  constructor(private options: ClaudeServiceOptions = {}) {
    this.options = {
      cwd: process.cwd(),
      permissionMode: 'default',
      maxTurns: 100,
      env: {
        ...process.env,
        DEBUG: 'true',
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:3456',
        ANTHROPIC_AUTH_TOKEN: 'your-secret-key',
      },
      debug: true,
      ...options
    };
  }

  async processPrompt(prompt: string, sessionId?: string): Promise<AsyncGenerator<ServerMessage, SessionResult, unknown>> {
    const actualSessionId = sessionId || generateSessionId();

    // Create or get session
    let session = this.activeSessions.get(actualSessionId);
    if (!session) {
      session = this.createSession(actualSessionId);
      this.activeSessions.set(actualSessionId, session);
    }

    // Update session state
    session.info.state = 'processing';
    session.info.lastActivity = new Date().toISOString();

    return this.createQueryStream(prompt, session);
  }

  private async *createQueryStream(prompt: string, session: Session): AsyncGenerator<ServerMessage, SessionResult, unknown> {
    const queue: ServerMessage[] = [];
    let isProcessing = true;
    let sessionResult: SessionResult | null = null;

    // Process the query in background
    const processingPromise = (async () => {
      try {
        const stream = query({
          prompt: (async function* () {
            const msg = {
              type: 'user',
              message: {
                role: 'user',
                content: prompt
              },
              session_id: session.id,
              parent_tool_use_id: null,
            } as SDKUserMessage;
            console.log("yield msg", msg);
            yield msg;

            // Keep yielding while processing
            while (isProcessing) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          })(),
          options: {
            canUseTool: async (toolName, toolInput, suggestions) => {
              if (session.info.config.debug) {
                console.log('Tool permission request:', { toolName, toolInput, suggestions });
              }

              // Auto-allow all tools like the demo
              return {
                behavior: "allow",
                updatedInput: toolInput,
                updatedPermissions: []
              };
            },
            env: session.info.config.env,
            maxTurns: session.info.config.maxTurns,
            cwd: session.info.config.cwd,
            permissionMode: session.info.config.permissionMode as PermissionMode,
            stderr: (data) => {
              console.error('Claude SDK stderr:', data);
            },
          }
        });

        for await (const sdkMessage of stream) {
          // Create project Claude message directly from SDK message
          const projectMessage = createProjectClaudeMessage(
            sdkMessage,
            session.id,
            session.messages.length
          );

          // Add message to session
          const sessionMessage = createSessionMessage(projectMessage);
          session.messages.push(sessionMessage);

          // Update session info
          session.info.messageCount = session.messages.length;
          session.info.lastActivity = new Date().toISOString();

          // Queue message for yielding
          queue.push(createClaudeMessageWrapper(projectMessage));

          // If we get a result message, prepare final result
          if (sdkMessage.type === 'result') {
            sessionResult = {
              sessionId: session.id,
              messages: session.messages.map(m => m.claudeMessage),
              result: projectMessage
            };

            session.info.state = 'completed';
            isProcessing = false;
            return;
          }
        }

        // If we reach here without a result message, create a default result
        if (!sessionResult) {
          sessionResult = {
            sessionId: session.id,
            messages: session.messages.map(m => m.claudeMessage),
          };
          session.info.state = 'completed';
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        sessionResult = {
          sessionId: session.id,
          messages: session.messages.map(m => m.claudeMessage),
          error: errorMessage
        };

        session.info.state = 'error';
      } finally {
        isProcessing = false;
      }
    })();

    // Yield queued messages while processing
    while (isProcessing || queue.length > 0) {
      if (queue.length > 0) {
        const message = queue.shift()!;
        yield message;
      } else {
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to prevent busy waiting
      }
    }

    // Wait for processing to complete
    await processingPromise;

    // Return the final result
    if (sessionResult) {
      return sessionResult;
    } else {
      // Fallback result
      return {
        sessionId: session.id,
        messages: session.messages.map(m => m.claudeMessage),
        error: 'Unknown error occurred'
      };
    }
  }

  private mapPermissionMode(mode: PermissionMode): 'default' | 'auto-allow' | 'deny' {
    switch (mode) {
      case 'default':
        return 'default';
      case 'acceptEdits':
        return 'auto-allow';
      case 'bypassPermissions':
        return 'auto-allow';
      case 'plan':
        return 'default';
      default:
        return 'default';
    }
  }

  private createSession(sessionId: string): Session {
    const config: SessionConfig = {
      cwd: this.options.cwd!,
      permissionMode: this.mapPermissionMode(this.options.permissionMode!),
      maxTurns: this.options.maxTurns!,
      env: this.options.env!,
      debug: this.options.debug!
    };

    const info = createSessionInfo(sessionId, config);

    return {
      id: sessionId,
      info,
      messages: [],
      config
    };
  }

  getSession(sessionId: string): Session | undefined {
    return this.activeSessions.get(sessionId);
  }

  getAllSessions(): Session[] {
    return Array.from(this.activeSessions.values());
  }

  updateSession(sessionId: string, updates: Partial<SessionInfo>): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.info = { ...session.info, ...updates, updatedAt: new Date().toISOString() };
    }
  }

  deleteSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  clearAllSessions(): void {
    this.activeSessions.clear();
  }

  getSessionStats() {
    const sessions = this.getAllSessions();
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.info.state === 'active' || s.info.state === 'processing').length,
      completedSessions: sessions.filter(s => s.info.state === 'completed').length,
      errorSessions: sessions.filter(s => s.info.state === 'error').length,
      averageMessageCount: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.info.messageCount, 0) / sessions.length
        : 0,
      totalMessages: sessions.reduce((sum, s) => sum + s.info.messageCount, 0)
    };
  }
}