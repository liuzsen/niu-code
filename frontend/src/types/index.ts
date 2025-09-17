// Export all Claude SDK message types
export * from './claude';

// Export WebSocket message types
export * from './websocket.ts';

// Export session management types
export * from './session.ts';

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