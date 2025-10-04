import type {
  ClientMessage,
  ServerMessage,
} from '../types/message'
import { WebSocketService, type WebSocketError } from './websocket'
import { wsService } from './websocket'
import { extract_tool_result } from '../utils/messageExtractors'
import { useChatManager } from '../stores/chatManager'
import { useWorkspace } from '../stores/workspace'
import { useGlobalToast } from '../stores/toast'
import type { PermissionResult, PermissionMode } from '@anthropic-ai/claude-code'
import type { MessageRecord } from '../types/session'
import { apiService } from './api'

export class MessageManager {
  public ws: WebSocketService
  private chatManager = useChatManager()
  private workspace = useWorkspace()
  private toast = useGlobalToast()

  // 新增：重放状态
  private replayingChat?: string
  private replayBuffer: ServerMessage[] = []

  constructor(ws: WebSocketService) {
    this.ws = ws
    // 注册 WebSocket 消息处理器
    this.ws.onMessage(this.handleServerMessage.bind(this))
    this.ws.onError(this.handleServerError.bind(this))
    this.ws.onConnected(this.handleWsConnected.bind(this))
    this.ws.onReconnectionFailed(this.handleReconnectionFailed.bind(this))
  }

  // 处理服务端消息
  private handleServerMessage(message: ServerMessage) {
    console.log('MessageManager received message:', message)

    // 新增：重放期间缓存消息
    if (this.replayingChat == message.chat_id) {
      this.replayBuffer.push(message)
      return
    }

    this.processMessage(message)
  }

  // 新增：实际处理消息的方法（重放和实时都使用）
  processMessage(message: ServerMessage) {
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
    this.registerAllChats()
  }

  // 处理重连失败（1分钟超时后）
  private handleReconnectionFailed() {
    console.log('Handling reconnection failure - clearing chats')

    // 清空所有对话
    this.chatManager.clearChats()

    // 显示 toast 提示
    this.toast.add({
      severity: 'error',
      summary: '连接中断',
      detail: '连接中断，请检查网络连接，重新连接后使用 /resume 命令恢复对话',
      life: 10000 // 显示10秒
    })
  }

  // 处理 WebSocket 错误
  private handleServerError(error: WebSocketError) {
    console.error('WebSocket error:', error)
    // 可以在这里处理全局的 WebSocket 错误
  }

  // 发送用户输入
  async sendUserInput(chatId: string, content: string) {
    console.log('Sending user input:', content)

    const chat = this.chatManager.getChat(chatId)
    if (!chat) {
      console.error('Chat not found:', chatId)
      return
    }

    this.chatManager.addUserMessage(chatId, {
      content
    })

    if (this.replayingChat == chatId) {
      return
    }

    await this.ensureChatStarted(chatId)

    const message = {
      chat_id: chatId,
      data: {
        kind: 'user_input' as const,
        content
      }
    }

    this.ws.sendMessage(message)
  }

  async ensureChatStarted(chatId: string) {
    // 如果对话还没有开始，通过 HTTP API 启动会话
    const chat = this.chatManager.getChat(chatId)
    if (!chat) {
      console.error('Chat not found:', chatId)
      return
    }

    const started = chat.started()
    if (!started && this.workspace.workingDirectory) {
      console.log("chat not started, calling HTTP API to start")

      // 先注册对话（WebSocket）
      this.sendRegisterChat(chatId)

      // 通过 HTTP API 开始对话
      try {
        await apiService.startChat({
          chat_id: chatId,
          work_dir: this.workspace.workingDirectory,
          mode: chat.session.permissionMode,
          config_name: chat.session.configName
        })
      } catch (error) {
        console.error('Failed to start chat via HTTP:', error)
        return
      }

      // 获取系统信息
      this.ws.sendMessage({
        chat_id: chatId,
        data: {
          kind: 'get_info'
        }
      })
    }
  }

  // 发送权限响应
  sendPermissionResponse(chatId: string, result: PermissionResult) {
    console.log('Sending permission response:', result)
    this.chatManager.foregroundChat.pendingRequest = undefined
    if (this.replayingChat == chatId) {
      return
    }

    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'permission_resp',
        ...result
      }
    }

    this.ws.sendMessage(message)
  }

  // 发送权限模式设置
  sendSetMode(chatId: string, mode: PermissionMode) {
    console.log('Sending set mode:', mode)

    this.ensureChatStarted(chatId)

    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'set_mode',
        mode
      }
    }

    this.ws.sendMessage(message)
  }

  // 发送停止命令
  sendStop(chatId: string) {
    console.log('Sending stop command')
    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'stop'
      }
    }

    this.ws.sendMessage(message)
  }

  registerAllChats() {
    for (const chat of this.chatManager.chats) {
      this.sendRegisterChat(chat.chatId)
    }
  }

  // 发送注册对话命令
  sendRegisterChat(chatId: string) {
    console.log('Registering chat:', chatId)
    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'register_chat'
      }
    }

    this.ws.sendMessage(message)
  }

  // 处理 Claude 消息
  private handleClaudeMessage(message: ServerMessage) {
    const { chat_id, data } = message
    if (data.kind != 'claude') { return }

    // 自动提取并设置 session_id（如果存在）
    const chat = this.chatManager.getChat(chat_id)
    if (chat && !chat.sessionId) {
      console.log(`Auto-setting sessionId for chat ${chat_id}: ${data.session_id}`)
      chat.sessionId = data.session_id
    }

    // 检查是否包含工具结果
    const toolResult = extract_tool_result(data)
    if (toolResult) {
      this.chatManager.addToolResult(chat_id, toolResult)
    } else {
      if (data.type == 'user' && data.message.role == 'user') {
        if (typeof data.message.content == 'string') {
          this.chatManager.addUserMessage(chat_id, { content: data.message.content })
        } else if (Array.isArray(data.message.content)) {
          for (const content of data.message.content) {
            if (content.type == 'text') {
              this.chatManager.addUserMessage(chat_id, { content: content.text })
            }
          }
        }
      } else {
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

  // 新增方法：重放状态管理
  startReplay(chatId: string) {
    this.replayingChat = chatId
    this.replayBuffer = []
  }

  endReplay() {
    this.replayingChat = undefined
    // 处理缓存的消息
    for (const message of this.replayBuffer) {
      this.processMessage(message)
    }
    this.replayBuffer = []
  }

  // 重放单条消息记录
  replayMessageRecord(chatId: string, record: MessageRecord) {
    const message = record.message

    if ('UserInput' in message) {
      this.sendUserInput(chatId, message.UserInput)
    }
    else if ('Claude' in message) {
      // 伪装成 ServerMessage
      const serverMessage: ServerMessage = {
        chat_id: chatId,
        data: { kind: 'claude', ...message.Claude }
      }
      this.processMessage(serverMessage)
    }
    else if ('SystemInfo' in message) {
      // 伪装成 ServerMessage
      const serverMessage: ServerMessage = {
        chat_id: chatId,
        data: { kind: 'system_info', ...message.SystemInfo }
      }
      this.processMessage(serverMessage)
    }
    else if ('CanUseTool' in message) {
      // 伪装成 ServerMessage
      const serverMessage: ServerMessage = {
        chat_id: chatId,
        data: { kind: 'can_use_tool', ...message.CanUseTool }
      }
      this.processMessage(serverMessage)
    } else if ('PermissionResp' in message) {
      this.sendPermissionResponse(chatId, message.PermissionResp)
    }
  }
}

// 全局变量，在 app 初始化时设置
export let messageManager: MessageManager

// 初始化函数
export function initMessageManager() {
  messageManager = new MessageManager(wsService)
}