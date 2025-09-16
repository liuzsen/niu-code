export interface UserMessage {
  type: 'user';
  message: {
    role: 'user';
    content: string;
  };
  session_id: string;
  parent_tool_use_id: string | null;
}

export interface ClientMessage {
  type: 'user_input' | 'tool_permission_response' | 'start_session';
  data: any;
}

export interface ServerMessage {
  type: 'claude_message' | 'tool_permission_request' | 'error' | 'session_started';
  data: any;
}

export interface ToolPermissionRequest {
  toolName: string;
  toolInput: any;
  suggestions?: any;
}

export interface ToolPermissionResponse {
  allowed: boolean;
  updatedInput?: any;
  remember?: boolean;
}