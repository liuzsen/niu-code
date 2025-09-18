import { defineStore } from 'pinia'
import type { ChatMessage } from '../types/chat'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources'
import { extract_tool_result } from '../utils/messageExtractors'


export const useChatStore = defineStore('chat', {
  state: () => ({
    standaloneMessages: [] as ChatMessage[],
    toolResults: new Map<string, ToolResultBlockParam>()
  }),

  actions: {
    // 统一的消息处理入口
    processMessage(chatMessage: ChatMessage) {
      if (chatMessage.from === 'user') {
        this.addMessage(chatMessage)
      } else {
        this.processAgentMessage(chatMessage)
      }
    },

    // 处理代理消息
    processAgentMessage(message: ChatMessage) {
      if (message.from !== 'agent') return

      if (message.serverMessage.type === 'claude_message') {
        const toolResult = extract_tool_result(message.serverMessage.data)
        if (toolResult) {
          this.setToolResult(toolResult.tool_use_id, toolResult)
        } else {
          this.addMessage(message)
        }
      } else {
        console.error('Unknown message:', message)
        this.addMessage(message)
      }
    },

    // 添加消息
    addMessage(message: ChatMessage) {
      this.standaloneMessages.push(message)
    },

    // 设置工具结果
    setToolResult(id: string, result: ToolResultBlockParam) {
      this.toolResults.set(id, result)
    },

    // 获取工具结果
    getToolResult(id: string): ToolResultBlockParam | undefined {
      return this.toolResults.get(id)
    },

    // 清空消息
    clearMessages() {
      this.standaloneMessages = []
    },

    // 清空工具结果
    clearToolResults() {
      this.toolResults.clear()
    },

    // 清空所有数据
    clearAll() {
      this.clearMessages()
      this.clearToolResults()
    }
  },

  getters: {
    // 消息数量
    messageCount: (state) => state.standaloneMessages.length,

    // 是否为空消息列表
    isEmptyMessages: (state) => state.standaloneMessages.length === 0,

    // 工具结果数量
    toolResultCount: (state) => state.toolResults.size,

    // 是否为空工具结果
    isEmptyToolResults: (state) => state.toolResults.size === 0,

    // 获取所有工具结果
    getAllToolResults: (state) => Array.from(state.toolResults.values()),

    // 获取最近的用户消息
    lastUserMessage: (state) => state.standaloneMessages
      .filter(msg => msg.from === 'user')
      .pop(),

    // 获取最近的代理消息
    lastAgentMessage: (state) => state.standaloneMessages
      .filter(msg => msg.from === 'agent')
      .pop()
  }
})