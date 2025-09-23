import type {
  ClientMessage,
  ServerMessage,
  ExtendedPermissionResult,
  WebSocketError
} from '../types/message'
import { WebSocketService } from './websocket'
import { wsService } from './websocket'
import { extract_tool_result } from '../utils/messageExtractors'
import type { ChatStore } from '../stores/chat'

export class MessageManager {
  private ws: WebSocketService
  private chatStore: ChatStore

  constructor(ws: WebSocketService, chatStore: ChatStore) {
    this.ws = ws
    this.chatStore = chatStore
    // 注册 WebSocket 消息处理器
    this.ws.onMessage(this.handleServerMessage.bind(this))
    this.ws.onError(this.handleServerError.bind(this))
  }

  // 处理服务端消息
  private handleServerMessage(message: ServerMessage) {
    console.log('MessageManager received message:', message)

    switch (message.data.kind) {
      case 'claude':
        this.handleClaudeMessage(message)
        break
      case 'can_use_tool':
        this.handleToolPermission(message)
        break
      case 'server_error':
        this.handleErrorMessage(message)
        break
      case 'system_info':
        this.handleSystemInfo(message)
        break
    }
  }

  // 处理 WebSocket 错误
  private handleServerError(error: WebSocketError) {
    console.error('WebSocket error:', error)
    // 可以在这里处理全局的 WebSocket 错误
  }

  // 发送用户输入
  sendUserInput(chatId: string, content: string) {
    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'user_input',
        content
      }
    }

    // 乐观更新
    this.chatStore.addUserMessage(chatId, {
      kind: 'user_input',
      content
    })

    // 设置处理状态
    this.chatStore.setSessionInputState(true, 'processing')

    this.ws.sendMessage(message)
  }

  // 发送权限响应
  sendPermissionResponse(chatId: string, result: ExtendedPermissionResult) {
    const message: ClientMessage = {
      chat_id: chatId,
      data: result.allowed
        ? { kind: 'permission_resp', behavior: 'allow', updatedInput: {} }
        : { kind: 'permission_resp', behavior: 'deny', message: 'Permission denied' }
    }

    this.ws.sendMessage(message)
  }

  // 处理 Claude 消息
  private handleClaudeMessage(message: ServerMessage) {
    const { chat_id, data } = message

    // Only process if it's actually a Claude message
    if (data.kind === 'claude') {
      // 检查是否包含工具结果
      const toolResult = extract_tool_result(data)
      if (toolResult) {
        this.chatStore.setToolResult(toolResult.tool_use_id, toolResult)
      } else {
        // 添加到消息列表
        this.chatStore.addClaudeMessage(chat_id, data)
      }
    }

    // 恢复输入状态
    this.chatStore.setSessionInputState(false, 'normal')
  }

  // 处理工具权限请求
  private handleToolPermission(message: ServerMessage) {
    const { chat_id, data } = message

    // Only process if it's actually a tool permission request
    if (data.kind === 'can_use_tool') {
      // 设置权限请求状态
      this.chatStore.setSessionInputState(true, 'tool_permission_pending', {
        tool_name: data.tool_name,
        tool_use_id: data.tool_use_id,
        input: data.input,
        suggestions: data.suggestions,
        chat_id: chat_id
      })
    }
  }

  // 处理错误消息
  private handleErrorMessage(message: ServerMessage) {
    // 简化错误处理，避免类型转换问题
    console.error('Server error:', message)
    this.chatStore.setSessionInputState(false, 'error', '服务器错误')
  }

  // 处理系统信息（暂时不做处理，因为类型定义有问题）
  private handleSystemInfo(message: ServerMessage) {
    console.log('System info received:', message.data)
    // TODO: 实现系统信息处理
  }
}

// 全局变量，在 app 初始化时设置
export let messageManager: MessageManager

// 初始化函数
export function initMessageManager(chatStore: ChatStore) {
  messageManager = new MessageManager(wsService, chatStore)
}