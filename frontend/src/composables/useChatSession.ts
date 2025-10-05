import type { MessageRecord } from '../types/session'
import type { ServerMessage } from '../types/message'
import { useMessageSender } from './useMessageSender'
import { useMessageHandler } from './useMessageHandler'
import { useChatManager } from '../stores/chat'

/**
 * 聊天会话管理 Composable
 * 负责会话注册、重放等会话生命周期管理
 */
export function useChatSession() {
  const { sendRegisterChat, sendUserInput, sendPermissionResponse } = useMessageSender()
  const { processMessage, startReplay, endReplay } = useMessageHandler()
  const chatManager = useChatManager()

  /**
   * 注册所有聊天会话
   * 在 WebSocket 连接成功后调用
   */
  function registerAllChats() {
    for (const chat of chatManager.chats) {
      sendRegisterChat(chat.chatId)
    }
  }

  /**
   * 重放单条消息记录
   * 用于恢复会话时重放历史消息
   */
  function replayMessageRecord(chatId: string, record: MessageRecord) {
    const message = record.message

    if ('UserInput' in message) {
      sendUserInput(chatId, message.UserInput)
    } else if ('Claude' in message) {
      // 伪装成 ServerMessage
      const serverMessage: ServerMessage = {
        chat_id: chatId,
        data: { kind: 'claude', ...message.Claude }
      }
      processMessage(serverMessage)
    } else if ('SystemInfo' in message) {
      // 伪装成 ServerMessage
      const serverMessage: ServerMessage = {
        chat_id: chatId,
        data: { kind: 'system_info', ...message.SystemInfo }
      }
      processMessage(serverMessage)
    } else if ('CanUseTool' in message) {
      // 伪装成 ServerMessage
      const serverMessage: ServerMessage = {
        chat_id: chatId,
        data: { kind: 'can_use_tool', ...message.CanUseTool }
      }
      processMessage(serverMessage)
    } else if ('PermissionResp' in message) {
      sendPermissionResponse(chatId, message.PermissionResp)
    }
  }

  return {
    registerAllChats,
    replayMessageRecord,
    startReplay,
    endReplay
  }
}
