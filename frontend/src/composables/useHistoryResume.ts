import { ref } from 'vue'
import type { Editor } from '@tiptap/core'
import { useWorkspace } from '../stores/workspace'
import { useChatManager } from '../stores/chatManager'
import { messageManager } from '../services/messageManager'
import { replayHistoryMessages as replayHistoryMessagesService } from '../services/historyReplay'
import type { ClaudeSessionInfo, HistoryLog } from '../types/history_log'

// 创建全局状态来控制历史会话选择模态框的显示
const isHistorySessionListVisible = ref(false)
const isRestoring = ref(false)
const restoreProgress = ref({ current: 0, total: 0 })
const editorRef = ref<Editor | null>(null)

export function useHistoryResume() {
  const workspace = useWorkspace()
  const chatManager = useChatManager()

  // 加载历史会话列表
  const loadHistorySessionsList = async (): Promise<ClaudeSessionInfo[]> => {
    if (!workspace.workingDirectory) {
      throw new Error('工作目录未设置')
    }

    const response = await fetch(`/api/load_history_session_infos?work_dir=${encodeURIComponent(workspace.workingDirectory)}`)

    if (!response.ok) {
      throw new Error(`加载失败: ${response.statusText}`)
    }

    const result = await response.json()
    return result.data
  }

  // 加载指定会话的详细日志
  const loadSessionLogs = async (sessionId: string): Promise<HistoryLog[]> => {
    if (!workspace.workingDirectory) {
      throw new Error('工作目录未设置')
    }

    const response = await fetch(`/api/load_session_logs?work_dir=${encodeURIComponent(workspace.workingDirectory)}&session_id=${encodeURIComponent(sessionId)}`)

    if (!response.ok) {
      throw new Error(`加载会话日志失败: ${response.statusText}`)
    }

    const result = await response.json()
    return result.data.logs
  }

  // 显示历史会话选择列表
  const showHistorySessionList = (editor?: Editor) => {
    editorRef.value = editor || null
    isHistorySessionListVisible.value = true
  }

  // 恢复历史会话
  const resumeHistorySession = async (sessionId: string) => {
    try {
      // 加载历史会话日志
      const historyLogs = await loadSessionLogs(sessionId)

      // 创建新的对话
      const newChat = chatManager.newChat('default')
      const newChatId = newChat.chatId

      // 开始新对话，传递 resume 字段
      if (workspace.workingDirectory) {
        // 先注册对话
        messageManager.sendRegisterChat(newChatId)

        // 然后开始对话，传递 resume 字段
        messageManager.sendStartChat(newChatId, {
          work_dir: workspace.workingDirectory,
          resume: sessionId
        })

        // 获取系统信息
        messageManager.ws.sendMessage({
          chat_id: newChatId,
          data: {
            kind: 'get_info'
          }
        })
      }

      // 5. 重放历史消息
      await replayHistoryMessages(newChatId, historyLogs)

      // 关闭模态框并重新聚焦
      isHistorySessionListVisible.value = false
      if (editorRef.value) {
        editorRef.value.commands.focus()
      }

      return newChatId
    } catch (error) {
      console.error('恢复历史会话失败:', error)
      throw error
    }
  }

  // 重放历史消息（使用专门的重放服务）
  const replayHistoryMessages = async (chatId: string, historyLogs: HistoryLog[]) => {
    isRestoring.value = true

    try {
      const sortedLogs = historyLogs.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )

      restoreProgress.value = { current: 0, total: sortedLogs.length }

      // 使用专门的重放服务
      await replayHistoryMessagesWithProgress(chatId, sortedLogs, (current) => {
        restoreProgress.value.current = current
      })
    } finally {
      isRestoring.value = false
      restoreProgress.value = { current: 0, total: 0 }
    }
  }

  // 带进度回调的历史消息重放
  const replayHistoryMessagesWithProgress = async (
    chatId: string,
    historyLogs: HistoryLog[],
    onProgress?: (current: number) => void
  ) => {
    await replayHistoryMessagesService(chatId, historyLogs)

    // 模拟进度更新
    if (onProgress) {
      for (let i = 0; i < historyLogs.length; i++) {
        onProgress(i + 1)
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
  }

  return {
    isHistorySessionListVisible,
    isRestoring,
    restoreProgress,
    loadHistorySessionsList,
    loadSessionLogs,
    showHistorySessionList,
    resumeHistorySession
  }
}