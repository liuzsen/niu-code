import { v4 as uuidv4 } from 'uuid'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources'
import type { PermissionMode, SDKMessage, SDKSystemMessage } from '@anthropic-ai/claude-code'
import type { UserInput, ToolPermissionRequest } from '../types/message'
import type { ClaudeSystemInfo } from '../types/message'
import { defineStore } from 'pinia'

export class ChatState {
  chatId: string = uuidv4()
  sessionId?: string // 后端 session_id

  // 会话信息
  session: {
    permissionMode: PermissionMode
    configName?: string
    systemInit?: SDKSystemMessage
    systemInfo?: ClaudeSystemInfo
  }

  // 消息列表
  messages: ChatMessageData[] = []

  // 工具结果
  toolResults: Map<string, ToolResultBlockParam> = new Map()

  pendingRequest?: ToolPermissionRequest

  // 对话状态管理
  isGenerating: boolean = false

  constructor(mode: PermissionMode = 'plan', configName?: string) {
    this.session = {
      permissionMode: mode,
      configName
    }
  }

  started(): boolean {
    return this.sessionId !== undefined || this.messages.length > 0
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

  // 对话状态管理方法
  startGenerating() {
    this.isGenerating = true
  }

  stopGenerating() {
    this.isGenerating = false
  }
}

export type ChatMessageData =
  | { from: 'human'; content: UserInput }
  | { from: 'agent'; content: SDKMessage }

/**
 * 聊天状态管理 Store
 * 只负责状态管理，不包含业务逻辑
 */
export const useChatStore = defineStore('chat', {
  state: () => ({
    chats: [new ChatState()] as ChatState[]
  }),

  getters: {
    foregroundChat: (state): ChatState => state.chats[0]
  },

  actions: {
    /**
     * 创建新的聊天会话
     */
    newChat(mode?: PermissionMode, configName?: string): ChatState {
      const chat = new ChatState(mode, configName)
      this.chats.unshift(chat)
      return chat
    },

    /**
     * 清空所有聊天会话
     */
    clearChats() {
      this.chats = [this.newChat()]
    },

    removeChat(chatId: string) {
      this.chats = this.chats.filter((chat) => chat.chatId !== chatId)
    },

    isEmpty() {
      return this.chats.length === 0
    },

    /**
     * 根据 chatId 获取聊天会话
     */
    getChat(chatId: string): ChatState | undefined {
      return this.chats.find((chat) => chat.chatId === chatId)
    },

    /**
     * 根据 sessionId 获取聊天会话
     */
    getChatBySessionId(sessionId: string): ChatState | undefined {
      return this.chats.find((chat) => chat.sessionId === sessionId)
    },

    /**
     * 切换到指定聊天会话（移到前台）
     */
    switchToChat(chatId: string) {
      const chat = this.getChat(chatId)
      if (!chat) return

      // 将选中的会话移到数组开头（前台）
      const index = this.chats.indexOf(chat)
      this.chats.splice(index, 1)
      this.chats.unshift(chat)
    },

    /**
     * 添加工具结果
     */
    addToolResult(chatId: string, result: ToolResultBlockParam) {
      const chat = this.getChat(chatId)
      chat?.addToolResult(result)
    },

    /**
     * 添加用户消息
     */
    addUserMessage(chatId: string, content: UserInput) {
      const chat = this.getChat(chatId)
      chat?.addUserMessage(content)
    },

    /**
     * 添加 Claude 消息
     */
    addClaudeMessage(chatId: string, content: SDKMessage) {
      const chat = this.getChat(chatId)
      chat?.addClaudeMessage(content)
    },

    /**
     * 设置系统信息
     */
    setSystemInfo(chatId: string, info: ClaudeSystemInfo) {
      const chat = this.getChat(chatId)
      chat?.setSystemInfo(info)
    },

    /**
     * 设置待处理的工具权限请求
     */
    setPendingToolUseRequest(chatId: string, request: ToolPermissionRequest) {
      const chat = this.getChat(chatId)
      chat?.setPendingRequest(request)
    },

    /**
     * 开始生成回复
     */
    startGenerating(chatId: string) {
      const chat = this.getChat(chatId)
      chat?.startGenerating()
    },

    /**
     * 停止生成回复
     */
    stopGenerating(chatId: string) {
      const chat = this.getChat(chatId)
      chat?.stopGenerating()
    }
  }
})

// 向后兼容：保留旧的导出名称
export const useChatManager = useChatStore
