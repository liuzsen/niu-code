// Export WebSocket message types
export * from './ws-message.ts';

// Tool permission types (updated to remove 'any')
export interface ToolPermissionRequest {
  toolName: string;
  toolInput: Record<string, unknown>;
  suggestions?: Record<string, unknown>;
}

export interface ToolPermissionResponse {
  allowed: boolean;
  updatedInput?: Record<string, unknown>;
  remember?: boolean;
}