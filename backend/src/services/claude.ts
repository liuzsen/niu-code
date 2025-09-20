import { query, SDKUserMessage, PermissionMode } from '@anthropic-ai/claude-code';
import { ClaudeMessageWrapper, ServerMessage, createClaudeMessageWrapper } from '../types/ws-message.js';
import { SessionConfig } from '../types/session.js';

export interface ClaudeServiceOptions {
  cwd?: string;
  permissionMode?: PermissionMode;
  maxTurns?: number;
  env?: Record<string, string>;
  debug?: boolean;
}

export interface SessionResult {
  sessionId: string;
  claude_messages: ClaudeMessageWrapper[];
  result?: ClaudeMessageWrapper;
  error?: string;
}

export class ClaudeService {
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

  async processPrompt(prompt: string): Promise<AsyncGenerator<ServerMessage, SessionResult, unknown>> {
    return this.createQueryStream(prompt, this.getSessionConfig());
  }

  private async *createQueryStream(prompt: string, config: SessionConfig): AsyncGenerator<ServerMessage, SessionResult, unknown> {
    const queue: ServerMessage[] = [];
    let isProcessing = true;
    let sessionResult: SessionResult | null = null;
    let messages: ClaudeMessageWrapper[] = []
    let sessionId = "no-session-id"

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
              session_id: "",
              parent_tool_use_id: null,
            } as SDKUserMessage;
            yield msg;

            // Keep yielding while processing
            while (isProcessing) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          })(),
          options: {
            canUseTool: async (toolName, toolInput, suggestions) => {
              if (config.debug) {
                console.log('Tool permission request:', { toolName, toolInput, suggestions });
              }

              // Auto-allow all tools like the demo
              return {
                behavior: "allow",
                updatedInput: toolInput,
                updatedPermissions: []
              };
            },
            env: config.env,
            maxTurns: config.maxTurns,
            cwd: config.cwd,
            permissionMode: config.permissionMode as PermissionMode,
            stderr: (data) => {
              console.error('Claude SDK stderr:', data);
            },
          }
        });

        let index = 0;

        for await (const sdkMessage of stream) {
          let serverMsg = createClaudeMessageWrapper(index, sdkMessage);
          sessionId = sdkMessage.session_id;
          index += 1;
          messages.push(serverMsg);
          queue.push(serverMsg);

          // If we get a result message, prepare final result
          if (sdkMessage.type === 'result') {
            sessionResult = {
              sessionId: sdkMessage.session_id,
              claude_messages: messages,
              result: serverMsg
            };

            isProcessing = false;
            return;
          }
        }

        // If we reach here without a result message, create a default result
        if (!sessionResult) {
          sessionResult = {
            sessionId: messages[0].sdkMessage.session_id,
            claude_messages: messages,
          };
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        sessionResult = {
          sessionId,
          claude_messages: messages,
          error: errorMessage
        };
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
        sessionId,
        claude_messages: messages,
        error: 'Unknown error occurred'
      };
    }
  }

  private getSessionConfig(): SessionConfig {
    const config: SessionConfig = {
      cwd: this.options.cwd!,
      permissionMode: this.options.permissionMode || "default",
      maxTurns: this.options.maxTurns!,
      env: this.options.env!,
      debug: this.options.debug!
    };

    return config
  }
}