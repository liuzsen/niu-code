import { onMounted, onUnmounted, ref } from 'vue'
import type { ServerMessage } from '../types/message'
import { useWebSocket } from './useWebSocket'
import { useChatManager } from '../stores/chat'
import { extract_tool_result } from '../utils/messageExtractors'
import { errorHandler } from '../services/errorHandler'

// 定义返回类型
interface MessageHandlerInstance {
  startReplay: (chatId: string) => void
  endReplay: () => void
  handleServerMessage: (message: ServerMessage) => void
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
    console.log('useMessageHandler: 返回已存在的消息处理器实例')
    return messageHandlerInstance
  }

  console.log('useMessageHandler: 创建新的消息处理器实例')

  const { ws } = useWebSocket()
  const chatManager = useChatManager()

  // 重放状态
  const replayingChat = ref<string | undefined>(undefined)
  const replayBuffer = ref<ServerMessage[]>([])

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
      chatManager.setPendingToolUseRequest(chat_id, data)
    }
  }

  // 处理错误消息
  async function handleErrorMessage(message: ServerMessage) {
    console.error('Server error:', message)

    if (message.data.kind === 'server_error') {
      const error = errorHandler.createServerError(
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
    // 注册所有聊天会在 useChatSession 中处理
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
    handleServerMessage,
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
