import type { ServerMessage } from './ws-message'

export type MessageFrom = 'user' | 'agent'

export interface BaseChatMessage {
  id: string
  from: MessageFrom
  timestamp: number
}

export interface UserMessage extends BaseChatMessage {
  from: 'user'
  content: string
}

export interface AgentMessage extends BaseChatMessage {
  from: 'agent'
  serverMessage: ServerMessage
}

export type ChatMessage = UserMessage | AgentMessage

export function createUserMessage(content: string): UserMessage {
  return {
    id: Date.now().toString(),
    from: 'user',
    content,
    timestamp: Date.now()
  }
}

export function createAgentMessage(serverMessage: ServerMessage): AgentMessage {
  return {
    id: Date.now().toString(),
    from: 'agent',
    serverMessage,
    timestamp: Date.now()
  }
}

export function isUserMessage(message: ChatMessage): message is UserMessage {
  return message.from === 'user'
}

export function isAgentMessage(message: ChatMessage): message is AgentMessage {
  return message.from === 'agent'
}