import type { ServerMessage } from './ws-message'

export type MessageFrom = 'user' | 'agent'

export interface UserMessage {
  from: 'user'
  content: string
  timestamp: number
}

export interface AgentMessage {
  from: 'agent'
  serverMessage: ServerMessage
  timestamp: number
}

export type ChatMessage = UserMessage | AgentMessage

export function createUserMessage(content: string): UserMessage {
  return {
    from: 'user',
    content,
    timestamp: Date.now()
  }
}

export function createAgentMessage(serverMessage: ServerMessage): AgentMessage {
  return {
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