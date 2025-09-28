import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources'
import type { ModelInfo, PermissionMode, PermissionUpdate, SDKMessage, SDKSystemMessage, SlashCommand } from '@anthropic-ai/claude-code'
import type {
  UserInput,
  ToolInputSchemasWithName,
} from '../types/message'
import type { ChatMessage } from '../types'
import { appCommands } from '../components/slash-commands/SlashCommandSuggestion'

export interface ChatState {
  systemInfo?: ChatSystemInfo

  // 会话信息
  currentSession: {
    id: string
    title: string
    createdAt: number
    systemInit?: SDKSystemMessage
    permissionMode: PermissionMode
  }

  // 消息列表
  messages: ChatMessage[]

  // 工具结果
  toolResults: Map<string, ToolResultBlockParam>

  // 输入状态
  inputState: {
    disabled: boolean
    reason: InputDisableReason
    pendingRequest?: ToolPermissionRequest
    error?: string
  }
}

export interface ToolPermissionRequest {
  tool_use: ToolInputSchemasWithName
  suggestions?: PermissionUpdate[]
  chat_id: string
}

export interface ChatSystemInfo {
  commands: SlashCommand[],
  models: ModelInfo[]
}

export interface ChatStore {
  currentSession: ChatState['currentSession']
  messages: ChatState['messages']
  toolResults: ChatState['toolResults']
  inputState: ChatState['inputState']
  systemInfo?: ChatState['systemInfo']

  // Actions
  addUserMessage: (chatId: string, content: UserInput) => void
  addClaudeMessage: (chatId: string, content: SDKMessage) => void
  setToolResult: (toolUseId: string, result: ToolResultBlockParam) => void
  setSessionInputState: (disabled: boolean, reason: InputDisableReason, pendingRequest?: ToolPermissionRequest | string) => void
  handlePermissionResult: () => void
  getCurrentChatId: () => string
  setSystemInfo: (commands: SlashCommand[], models: ModelInfo[]) => void

  loadFromJson: (jsonString: string) => void
  clearAll: () => void
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    currentSession: {
      id: uuidv4(),
      title: '新对话',
      createdAt: Date.now(),
      permissionMode: 'default'
    },
    systemInfo: undefined,
    messages: [],
    toolResults: new Map(),
    inputState: {
      disabled: false,
      reason: 'normal'
    }
  }),

  actions: {

    // 添加用户消息
    addUserMessage(chatId: string, content: UserInput) {
      const message: ChatMessage = {
        chat_id: chatId,
        data: {
          from: 'human',
          content
        }
      }
      this.messages.push(message)
    },

    // 添加 Claude 消息
    addClaudeMessage(chatId: string, content: SDKMessage) {
      if (content.type === 'system' && content.subtype === 'init') {
        if (this.currentSession.systemInit) return
        this.currentSession.systemInit = content
      }
      const message: ChatMessage = {
        chat_id: chatId,
        data: {
          from: 'agent',
          content
        }
      }
      this.messages.push(message)
    },

    setSystemInfo(commands: SlashCommand[], models: ModelInfo[]) {
      console.log("set system info")
      this.systemInfo = {
        commands: commands.concat(appCommands),
        models
      }
    },

    // 设置工具结果
    setToolResult(toolUseId: string, result: ToolResultBlockParam) {
      this.toolResults.set(toolUseId, result)
    },

    // 设置输入状态
    setSessionInputState(
      disabled: boolean,
      reason: InputDisableReason,
      pendingRequest?: ToolPermissionRequest | string
    ) {
      this.inputState = {
        disabled,
        reason,
        pendingRequest: typeof pendingRequest === 'string' ? undefined : pendingRequest,
        error: reason === 'error' && typeof pendingRequest === 'string' ? pendingRequest : undefined
      }
    },

    // 处理权限结果
    handlePermissionResult() {
      this.setSessionInputState(false, 'normal')
      // 清除权限请求
      this.inputState.pendingRequest = undefined
    },


    // 获取当前会话 ID
    getCurrentChatId(): string {
      return this.currentSession.id
    },

    // 从 JSON 字符串加载状态
    loadFromJson(jsonString: string): void {
      try {
        const data = JSON.parse(jsonString)

        this.currentSession = data.currentSession
        this.messages = data.messages
        this.inputState = data.inputState
        this.toolResults = new Map(Object.entries(data.toolResults || {}))
      } catch (error) {
        console.error('Failed to load chat state from JSON:', error)
        throw new Error(`Failed to load chat state: ${error}`)
      }
    },

    // 清空所有数据
    reset(): void {
      this.currentSession = {
        id: uuidv4(),
        title: '新对话',
        createdAt: Date.now(),
        permissionMode: "default"
      }
      this.messages = []
      this.toolResults = new Map()
      this.inputState = {
        disabled: false,
        reason: 'normal'
      }
    },
  },

  getters: {
    // 消息数量
    messageCount: (state: ChatState) => state.messages.length,

    // 输入是否被禁用
    isInputDisabled: (state: ChatState) => state.inputState.disabled,

    // 输入禁用原因
    inputDisableReason: (state: ChatState) => state.inputState.reason,

    // 待处理的权限请求
    pendingPermissionRequest: (state: ChatState) => state.inputState.pendingRequest,

    // 获取工具结果
    getToolResult: (state: ChatState) => (toolUseId: string) => state.toolResults.get(toolUseId),

    cwd: (state: ChatState) => state.currentSession.systemInit?.cwd
  }
})

// 输入状态类型
export type InputDisableReason =
  | 'normal'
  | 'processing'
  | 'tool_permission_pending'
  | 'disconnected'
  | 'error'
