import { PermissionMode } from '@anthropic-ai/claude-code';

export interface SessionConfig {
  cwd: string;
  permissionMode: PermissionMode
  maxTurns: number;
  env: Record<string, string>;
  debug: boolean;
}
