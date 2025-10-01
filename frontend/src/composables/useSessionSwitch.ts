import { ref } from 'vue'
import { apiService } from '../services/api'
import { messageManager } from '../services/messageManager'
import { useChatManager } from '../stores/chatManager'
import { useWorkspace } from '../stores/workspace'
import type { SessionInfo } from '../types/session'
import type { Editor } from '@tiptap/core'

const isSessionListVisible = ref(false)
const isRestoring = ref(false)
const restoreProgress = ref({ current: 0, total: 0 })
const editorRef = ref<Editor | null>(null)

export function useSessionSwitch() {
  const chatManager = useChatManager()
  const workspace = useWorkspace()

  async function showSessionList(editor?: Editor) {
    editorRef.value = editor || null
    isSessionListVisible.value = true
  }

  async function loadActiveSessions(): Promise<SessionInfo[]> {
    if (!workspace.workingDirectory) {
      throw new Error('工作目录未设置')
    }
    return await apiService.loadActiveSessions(workspace.workingDirectory)
  }

  async function switchToSession(cliId: number) {
    // 检查前端是否已有该 cli_id 的对话
    const existingChat = chatManager.getChatByCliId(cliId)

    if (existingChat) {
      // 如果已存在，直接切换到前台
      chatManager.switchToChat(existingChat.chatId)
      isSessionListVisible.value = false
      // 重新聚焦到编辑器
      if (editorRef.value) {
        editorRef.value.commands.focus()
      }
      return
    }

    // 如果不存在，进行恢复操作（内部逻辑）
    await restoreSession(cliId)
  }

  async function restoreSession(cliId: number) {
    // 创建新的 ChatState
    const newChat = chatManager.newChat('default')
    newChat.cliId = cliId // 设置 cli_id

    // 先注册新的 chat_id
    messageManager.sendRegisterChat(newChat.chatId)

    // 开始恢复
    messageManager.startReplay()
    isRestoring.value = true

    try {
      const records = await apiService.reconnectSession(cliId, newChat.chatId)
      restoreProgress.value = { current: 0, total: records.length }

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        restoreProgress.value.current = i + 1

        // 统一通过 messageManager 处理重放消息
        messageManager.replayMessageRecord(newChat.chatId, record)

        // 可选：流式效果延迟
        // await new Promise(resolve => setTimeout(resolve, 10))
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
    loadActiveSessions,
    switchToSession
  }
}