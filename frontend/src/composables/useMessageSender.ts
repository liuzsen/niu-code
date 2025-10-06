import type { ClientMessage } from '../types/message'
import type { PermissionResult, PermissionMode } from '@anthropic-ai/claude-code'
import { useWebSocket } from './useWebSocket'
import { useChatManager } from '../stores/chat'
import { useWorkspace } from '../stores/workspace'
import { apiService } from '../services/api'
import { useMessageHandler } from './useMessageHandler'

// 定义返回类型
interface MessageSenderInstance {
  sendUserInput: (chatId: string, content: string) => Promise<void>
  sendPermissionResponse: (chatId: string, result: PermissionResult) => void
  sendSetMode: (chatId: string, mode: PermissionMode) => Promise<void>
  sendStop: (chatId: string) => void
  sendRegisterChat: (chatId: string) => void
}

// 全局去重标志
let messageSenderInstance: MessageSenderInstance | null = null

/**
 * 消息发送 Composable - 带去重逻辑
 */
export function useMessageSender() {
  // 去重：如果已经创建过实例，直接返回现有实例
  if (messageSenderInstance) {
    console.log('useMessageSender: 返回已存在的消息发送器实例')
    return messageSenderInstance
  }

  console.log('useMessageSender: 创建新的消息发送器实例')

  const { ws } = useWebSocket()
  const chatManager = useChatManager()
  const workspace = useWorkspace()
  const messageHandler = useMessageHandler()

  /**
   * 发送用户输入消息
   */
  async function sendUserInput(chatId: string, content: string) {
    console.log('Sending user input:', content)

    const chat = chatManager.getChat(chatId)
    if (!chat) {
      console.error('Chat not found:', chatId)
      return
    }

    // 更新本地状态
    chatManager.addUserMessage(chatId, { content })

    if (messageHandler.isReplaying) {
      return
    }

    // 确保会话已启动
    await ensureChatStarted(chatId)

    // 发送到服务器
    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'user_input',
        content
      }
    }

    ws.sendMessage(message)
  }

  /**
   * 确保聊天会话已启动
   */
  async function ensureChatStarted(chatId: string) {
    const chat = chatManager.getChat(chatId)
    if (!chat) {
      console.error('Chat not found:', chatId)
      return
    }

    const started = chat.started()
    if (!started && workspace.workingDirectory) {
      console.log('chat not started, calling HTTP API to start')

      // 先注册对话（通过 WebSocket）
      sendRegisterChat(chatId)

      // 通过 HTTP API 开始对话
      const result = await apiService.startChat({
        chat_id: chatId,
        work_dir: workspace.workingDirectory,
        mode: chat.session.permissionMode,
        config_name: chat.session.configName
      })

      if (!result) {
        return
      }

      // 获取系统信息
      ws.sendMessage({
        chat_id: chatId,
        data: {
          kind: 'get_info'
        }
      })
    }
  }

  /**
   * 发送权限响应
   */
  function sendPermissionResponse(chatId: string, result: PermissionResult) {
    console.log('Sending permission response:', result)

    // 清除待处理的权限请求
    chatManager.foregroundChat.pendingRequest = undefined

    if (messageHandler.isReplaying) {
      return
    }

    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'permission_resp',
        ...result
      }
    }

    ws.sendMessage(message)
  }

  /**
   * 发送权限模式设置
   */
  async function sendSetMode(chatId: string, mode: PermissionMode) {
    console.log('Sending set mode:', mode)

    await ensureChatStarted(chatId)

    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'set_mode',
        mode
      }
    }

    ws.sendMessage(message)
  }

  /**
   * 发送停止命令
   */
  function sendStop(chatId: string) {
    console.log('Sending stop command')

    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'stop'
      }
    }

    ws.sendMessage(message)
  }

  /**
   * 发送注册对话命令
   */
  function sendRegisterChat(chatId: string) {
    console.log('Registering chat:', chatId)

    const message: ClientMessage = {
      chat_id: chatId,
      data: {
        kind: 'register_chat'
      }
    }

    ws.sendMessage(message)
  }

  messageSenderInstance = {
    sendUserInput,
    sendPermissionResponse,
    sendSetMode,
    sendStop,
    sendRegisterChat
  }

  return messageSenderInstance
}
