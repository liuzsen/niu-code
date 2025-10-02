import { ref } from 'vue'
import { apiService } from '../services/api'
import { messageManager } from '../services/messageManager'
import { useChatManager } from '../stores/chatManager'
import { useWorkspace } from '../stores/workspace'
import type { UnifiedSessionInfo } from '../types/session'
import type { Editor } from '@tiptap/core'

const isSessionListVisible = ref(false)
const isRestoring = ref(false)
const restoreProgress = ref({ current: 0, total: 0 })
const editorRef = ref<Editor | null>(null)

export function useResume() {
  const chatManager = useChatManager()
  const workspace = useWorkspace()

  async function showSessionList(editor?: Editor) {
    editorRef.value = editor || null
    isSessionListVisible.value = true
  }

  async function loadSessionList(): Promise<UnifiedSessionInfo[]> {
    if (!workspace.workingDirectory) {
      throw new Error('工作目录未设置')
    }
    return await apiService.loadSessionList(workspace.workingDirectory)
  }

  async function resumeSession(sessionId: string) {
    // 快速路径：检查前端是否已有该 session_id 的对话
    const existingChat = chatManager.getChatBySessionId(sessionId)

    if (existingChat) {
      // 如果已存在，直接切换到前台
      console.log(`Fast path: switching to existing chat ${existingChat.chatId}`)
      chatManager.switchToChat(existingChat.chatId)
      isSessionListVisible.value = false
      // 重新聚焦到编辑器
      if (editorRef.value) {
        editorRef.value.commands.focus()
      }
      return
    }

    // 恢复路径：从后端恢复会话
    await restoreSession(sessionId)
  }

  async function restoreSession(sessionId: string) {
    if (!workspace.workingDirectory) {
      throw new Error('工作目录未设置')
    }

    // 创建新的 ChatState
    const newChat = chatManager.newChat('default')

    // 先注册新的 chat_id
    messageManager.sendRegisterChat(newChat.chatId)

    // 开始恢复
    messageManager.startReplay()
    isRestoring.value = true

    try {
      const records = await apiService.startChat({
        chat_id: newChat.chatId,
        work_dir: workspace.workingDirectory,
        mode: newChat.session.permissionMode,
        resume: sessionId
      })

      restoreProgress.value = { current: 0, total: records.length }

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        restoreProgress.value.current = i + 1

        // 统一通过 messageManager 处理重放消息
        messageManager.replayMessageRecord(newChat.chatId, record)
      }

      // 自动从消息中提取 sessionId（如果尚未设置）
      if (!newChat.sessionId) {
        newChat.sessionId = sessionId
      }

      isSessionListVisible.value = false
    } finally {
      messageManager.endReplay()
      isRestoring.value = false
      restoreProgress.value = { current: 0, total: 0 }
      // 恢复完成后重新聚焦到编辑器
      if (editorRef.value) {
        editorRef.value.commands.focus()
      }
    }
  }

  return {
    isSessionListVisible,
    isRestoring,
    restoreProgress,
    showSessionList,
    loadSessionList,
    resumeSession
  }
}
