import { ref } from 'vue'
import { apiService } from '../services/api'
import { messageManager } from '../services/messageManager'
import { useChatManager } from '../stores/chatManager'
import { useWorkspace } from '../stores/workspace'
import type { SessionInfo, MessageRecord } from '../types/session'

const isSessionListVisible = ref(false)
const isReplaying = ref(false)
const replayProgress = ref({ current: 0, total: 0 })

export function useSessionResume() {
  const chatManager = useChatManager()
  const workspace = useWorkspace()

  async function showSessionList() {
    isSessionListVisible.value = true
  }

  async function loadActiveSessions(): Promise<SessionInfo[]> {
    if (!workspace.workingDirectory) {
      throw new Error('工作目录未设置')
    }
    return await apiService.loadActiveSessions(workspace.workingDirectory)
  }

  async function resumeSession(cliId: number) {
    // 创建新的 ChatState 或使用现有的
    const newChat = chatManager.newChat('default')

    // 注册新的 chat_id
    messageManager.sendRegisterChat(newChat.chatId)

    // 开始重放
    messageManager.startReplay()
    isReplaying.value = true

    try {
      const records = await apiService.reconnectSession(cliId, newChat.chatId)
      replayProgress.value = { current: 0, total: records.length }

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        replayProgress.value.current = i + 1

        await replayMessage(newChat.chatId, record)

        // 可选：流式效果延迟
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      isSessionListVisible.value = false
    } finally {
      messageManager.endReplay()
      isReplaying.value = false
      replayProgress.value = { current: 0, total: 0 }
    }
  }

  async function replayMessage(chatId: string, record: MessageRecord) {
    const message = record.message

    // 判断 CacheMessage 的类型
    if ('UserInput' in message) {
      chatManager.addUserMessage(chatId, { content: message.UserInput })
    }
    else if ('Claude' in message) {
      chatManager.addClaudeMessage(chatId, message.Claude)
    }
    else if ('SystemInfo' in message) {
      chatManager.setSystemInfo(chatId, message.SystemInfo)
    }
    else if ('CanUseTool' in message) {
      chatManager.setPendingToolUseRequest(chatId, message.CanUseTool)
    }
    // PermissionResp 不需要在界面展示
  }

  return {
    isSessionListVisible,
    isReplaying,
    replayProgress,
    showSessionList,
    loadActiveSessions,
    resumeSession
  }
}