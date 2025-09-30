import type {
  ClientMessage,
  ServerMessage,
} from '../types/message'
import { WebSocketService, type WebSocketError } from './websocket'
import { wsService } from './websocket'
import { extract_tool_result } from '../utils/messageExtractors'
import { useChatManager } from '../stores/chatManager'
import { useWorkspace } from '../stores/workspace'
import type { PermissionResult } from '@anthropic-ai/claude-code'

export class MessageManager {
  private ws: WebSocketService
  private chatManager = useChatManager()
  private workspace = useWorkspace()

  constructor(ws: WebSocketService) {
    this.ws = ws
    // 注册 WebSocket 消息处理器
    this.ws.onMessage(this.handleServerMessage.bind(this))
    this.ws.onError(this.handleServerError.bind(this))
    this.ws.onConnected(this.handleWsConnected.bind(this))
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

  private handleWsConnected() {
    const foregroundChat = this.chatManager.foregroundChat
    if (foregroundChat.started()) {
      return
    }

    if (!this.workspace.workingDirectory) {
      return
    }

    this.ws.sendMessage({
      chat_id: foregroundChat.chatId,
      data: {
        kind: 'start_chat',
        work_dir: this.workspace.workingDirectory,
      }
    })
    this.ws.sendMessage({
      chat_id: foregroundChat.chatId,
      data: {
        kind: 'get_info',
      }
    })
  }

  // 处理 WebSocket 错误
  private handleServerError(error: WebSocketError) {
    console.error('WebSocket error:', error)
    // 可以在这里处理全局的 WebSocket 错误
  }

  // 发送用户输入
  sendUserInput(chatId: string, content: string) {
    console.log('Sending user input:', content)
    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'user_input',
        content
      }
    }

    // 乐观更新
    this.chatManager.addUserMessage(chatId, {
      content
    })

    this.ws.sendMessage(message)
  }

  // 发送权限响应
  sendPermissionResponse(chatId: string, result: PermissionResult) {
    console.log('Sending permission response:', result)
    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'permission_resp',
        ...result
      }
    }

    this.ws.sendMessage(message)
  }

  // 处理 Claude 消息
  private handleClaudeMessage(message: ServerMessage) {
    const { chat_id, data } = message

    if (data.kind === 'claude') {
      // 检查是否包含工具结果
      const toolResult = extract_tool_result(data)
      if (toolResult) {
        this.chatManager.addToolResult(chat_id, toolResult)
      } else {
        // 添加到消息列表
        this.chatManager.addClaudeMessage(chat_id, data)
      }
    }
  }

  // 处理工具权限请求
  private handleToolPermission(message: ServerMessage) {
    const { chat_id, data } = message
    if (data.kind === 'can_use_tool') {
      this.chatManager.setPendingToolUseRequest(chat_id, data)
    }
  }

  // 处理错误消息
  private handleErrorMessage(message: ServerMessage) {
    // 简化错误处理，避免类型转换问题
    console.error('Server error:', message)
    // TODO: 错误状态处理需要重新设计
  }

  private handleSystemInfo(message: ServerMessage) {
    if (message.data.kind != 'system_info') { return }
    this.chatManager.setSystemInfo(message.chat_id, message.data)
  }
}

// 全局变量，在 app 初始化时设置
export let messageManager: MessageManager

// 初始化函数
export function initMessageManager() {
  messageManager = new MessageManager(wsService)
}