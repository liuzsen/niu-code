import { onMounted, onUnmounted, ref } from 'vue'
import type { ServerMessage } from '../types/message'
import { useWebSocket } from './useWebSocket'
import { useChatManager } from '../stores/chat'
import { extract_tool_result } from '../utils/messageExtractors'
import { errorHandler } from '../services/errorHandler'
import { useMessageSender } from './useMessageSender'
import { notifyTaskCompleted, isUserActive, playDingSound, sendPlanApprovalNotification } from '../utils/notification'

// 定义返回类型
interface MessageHandlerInstance {
  startReplay: (chatId: string) => void
  endReplay: () => void
  processMessage: (message: ServerMessage) => void
  isReplaying: boolean
}

// 全局去重标志
let messageHandlerInstance: MessageHandlerInstance | null = null

/**
 * 消息处理 Composable - 带去重逻辑
 * 无论被调用多少次，事件监听器都只注册一次
 */
export function useMessageHandler() {
  // 去重：如果已经初始化过，直接返回现有实例
  if (messageHandlerInstance) {
    return messageHandlerInstance
  }

  const { ws } = useWebSocket()
  const chatManager = useChatManager()

  // 重放状态
  const replayingChat = ref<string | undefined>(undefined)
  const replayBuffer = ref<ServerMessage[]>([])

  function isReplaying() {
    return !!replayingChat.value
  }

  // 处理服务器消息（主入口）
  function handleServerMessage(message: ServerMessage) {
    // 重放期间缓存消息
    if (replayingChat.value === message.chat_id) {
      replayBuffer.value.push(message)
      return
    }

    // 直接处理消息
    processMessage(message)
  }

  // 实际处理消息的方法
  function processMessage(message: ServerMessage) {
    switch (message.data.kind) {
      case 'claude':
        handleClaudeMessage(message)
        break
      case 'can_use_tool':
        handleToolPermission(message)
        break
      case 'server_error':
        handleErrorMessage(message)
        break
      case 'system_info':
        handleSystemInfo(message)
        break
      case 'chat_removed':
        handleChatRemoved(message)
        break
    }
  }

  function handleChatRemoved(message: ServerMessage) {
    const { chat_id } = message
    chatManager.removeChat(chat_id)
    if (chatManager.isEmpty()) {
      chatManager.newChat()
    }
  }

  // 处理 Claude 消息
  function handleClaudeMessage(message: ServerMessage) {
    const { chat_id, data } = message
    if (data.kind !== 'claude') return

    // 自动提取并设置 session_id
    const chat = chatManager.getChat(chat_id)
    if (chat && !chat.sessionId) {
      chat.sessionId = data.session_id
    }

    console.log('Received Claude message:', data)
    // 检查是否为 SDKResultMessage，如果是则发送任务完成通知
    if (data.type === 'result' && !isReplaying()) {
      notifyTaskCompleted()
    }

    // 检查是否包含工具结果
    const toolResult = extract_tool_result(data)
    if (toolResult) {
      chatManager.addToolResult(chat_id, toolResult)
    } else {
      if (data.type === 'user' && data.message.role === 'user') {
        if (typeof data.message.content === 'string') {
          chatManager.addUserMessage(chat_id, { content: data.message.content })
        } else if (Array.isArray(data.message.content)) {
          for (const content of data.message.content) {
            if (content.type === 'text') {
              chatManager.addUserMessage(chat_id, { content: content.text })
            }
          }
        }
      } else {
        chatManager.addClaudeMessage(chat_id, data)
      }
    }
  }

  // 处理工具权限请求
  function handleToolPermission(message: ServerMessage) {
    const { chat_id, data } = message
    if (data.kind === 'can_use_tool') {
      // 如果是退出计划模式，且用户不在页面，则通知用户
      if (data.tool_use.tool_name === 'ExitPlanMode' && !isReplaying() && !isUserActive()) {
        playDingSound()
        sendPlanApprovalNotification()
      }
      chatManager.setPendingToolUseRequest(chat_id, data)
    }
  }

  // 处理错误消息
  async function handleErrorMessage(message: ServerMessage) {
    console.error('Server error:', message)

    if (message.data.kind === 'server_error') {
      const error = errorHandler.createClientError(
        'SYSTEM_ERROR',
        message.data.error
      )
      await errorHandler.handle(error)
    }
  }

  // 处理系统信息
  function handleSystemInfo(message: ServerMessage) {
    if (message.data.kind !== 'system_info') return
    chatManager.setSystemInfo(message.chat_id, message.data)
  }

  // 处理 WebSocket 连接成功
  function handleConnected() {
    console.log('WebSocket connected, registering all chats')
    for (const chat of chatManager.chats) {
      // 如果会话已启动，那么可能是重连，需要再次注册
      if (chat.started()) {
        console.log('Registering started chat:', chat.chatId)
        useMessageSender().sendRegisterChat(chat.chatId)
      }
    }
  }

  // 处理重连失败
  function handleReconnectionFailed() {
    console.log('Handling reconnection failure - clearing chats')
    chatManager.clearChats()
  }

  // 重放状态管理
  function startReplay(chatId: string) {
    replayingChat.value = chatId
    replayBuffer.value = []
  }

  function endReplay() {
    replayingChat.value = undefined
    // 处理缓存的消息
    for (const message of replayBuffer.value) {
      processMessage(message)
    }
    replayBuffer.value = []
  }


  // 创建实例
  messageHandlerInstance = {
    startReplay,
    endReplay,
    processMessage,
    get isReplaying() {
      return !!replayingChat.value
    }
  }

  // 保存清理函数的引用
  let cleanupMessage: (() => void) | null = null
  let cleanupConnected: (() => void) | null = null
  let cleanupReconnectionFailed: (() => void) | null = null

  // 在组件挂载时注册消息处理器
  onMounted(() => {
    console.log('useMessageHandler: 首次注册 WebSocket 事件监听器')
    cleanupMessage = ws.onMessage(handleServerMessage)
    cleanupConnected = ws.onConnected(handleConnected)
    cleanupReconnectionFailed = ws.onReconnectionFailed(handleReconnectionFailed)
  })

  // 在组件卸载时清理事件监听器
  onUnmounted(() => {
    if (cleanupMessage) cleanupMessage()
    if (cleanupConnected) cleanupConnected()
    if (cleanupReconnectionFailed) cleanupReconnectionFailed()
    console.log('useMessageHandler: 清理 WebSocket 事件监听器')
    // 重置实例，允许重新初始化
    messageHandlerInstance = null
  })

  return messageHandlerInstance
}
