import type { SDKMessage } from '@anthropic-ai/claude-code';

// 项目特有的 Claude 消息包装类型
export interface ProjectClaudeMessage {
  // 原始 SDK 消息
  sdkMessage: SDKMessage;

  // 项目特有的额外字段
  receivedAt: string;     // 接收时间
  sessionId: string;     // 会话 ID
  index: number;         // 消息索引
  timestamp: string;     // 时间戳
}

// 重导出 SDK 消息类型，方便其他文件使用
export type { SDKMessage } from '@anthropic-ai/claude-code';

// 便捷的类型别名
export type ClaudeMessage = ProjectClaudeMessage;

// 类型判断函数
export function isSystemMessage(message: ProjectClaudeMessage): boolean {
  return message.sdkMessage.type === 'system';
}

export function isAssistantMessage(message: ProjectClaudeMessage): boolean {
  return message.sdkMessage.type === 'assistant';
}

export function isUserMessage(message: ProjectClaudeMessage): boolean {
  return message.sdkMessage.type === 'user';
}

export function isResultMessage(message: ProjectClaudeMessage): boolean {
  return message.sdkMessage.type === 'result';
}

// 创建项目 Claude 消息的工厂函数
export function createProjectClaudeMessage(
  sdkMessage: SDKMessage,
  sessionId: string,
  index: number
): ProjectClaudeMessage {
  const now = new Date().toISOString();
  return {
    sdkMessage,
    receivedAt: now,
    sessionId,
    index,
    timestamp: now
  };
}