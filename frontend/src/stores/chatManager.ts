import { v4 as uuidv4 } from 'uuid'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources'
import type { PermissionMode, SDKMessage, SDKSystemMessage, } from '@anthropic-ai/claude-code'
import type {
  UserInput,
  ToolPermissionRequest,
} from '../types/message'
import type { ClaudeSystemInfo } from '../types/message'
import { defineStore } from 'pinia'

export class ChatState {
  chatId: string = uuidv4()

  // 会话信息
  session: {
    permissionMode: PermissionMode
    systemInit?: SDKSystemMessage
    systemInfo?: ClaudeSystemInfo
  }

  // 消息列表
  messages: ChatMessageData[] = []

  // 工具结果
  toolResults: Map<string, ToolResultBlockParam> = new Map()

  pendingRequest?: ToolPermissionRequest

  constructor(mode: PermissionMode) {
    this.session = {
      permissionMode: mode
    }
  }

  started(): boolean {
    return this.session.systemInit != undefined || this.messages.length > 0
  }

  addToolResult(result: ToolResultBlockParam) {
    this.toolResults.set(result.tool_use_id, result)
  }

  addUserMessage(content: UserInput) {
    this.messages.push({
      from: 'human',
      content
    })
  }

  addClaudeMessage(content: SDKMessage) {
    if (content.type === 'system' && content.subtype === 'init') {
      if (this.session.systemInit) return
      this.session.systemInit = content
    }
    this.messages.push({
      from: 'agent',
      content
    })
  }

  setPendingRequest(request: ToolPermissionRequest) {
    this.pendingRequest = request
  }

  setSystemInfo(content: ClaudeSystemInfo) {
    this.session.systemInfo = content
  }
}

export type ChatMessageData =
  | { from: 'human'; content: UserInput }
  | { from: 'agent'; content: SDKMessage }

export interface ChatManager {
  chats: ChatState[]
}

export const useChatManager = defineStore("chat-manager", {
  state: (): ChatManager => {
    return {
      chats: [new ChatState('default')]
    }
  },

  actions: {
    newChat(mode: PermissionMode = 'default'): ChatState {
      const chat = new ChatState(mode)
      this.chats.unshift(chat)
      return chat
    },

    addToolResult(chatId: string, result: ToolResultBlockParam) {
      const chat = this.getChat(chatId)
      chat?.addToolResult(result)
    },

    // 添加用户消息
    addUserMessage(chatId: string, content: UserInput) {
      const chat = this.getChat(chatId)
      chat?.addUserMessage(content)
    },

    // 添加 Claude 消息
    addClaudeMessage(chatId: string, content: SDKMessage) {
      const chat = this.getChat(chatId)
      chat?.addClaudeMessage(content)
    },

    setSystemInfo(chatId: string, info: ClaudeSystemInfo) {
      const chat = this.getChat(chatId)
      chat?.setSystemInfo(info)
    },

    setPendingToolUseRequest(chatId: string, request: ToolPermissionRequest) {
      const chat = this.getChat(chatId)
      chat?.setPendingRequest(request)
    },

    getChat(chatId: string): ChatState | undefined {
      return this.chats.find((chat) => chat.chatId == chatId)
    }
  },

  getters: {
    foregroundChat: (state): ChatState => state.chats[0]
  }
})
