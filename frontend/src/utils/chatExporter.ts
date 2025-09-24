import type { ToastServiceMethods } from 'primevue'
import { useChatStore, type ChatState } from '../stores/chat'

export type ChatExport = ChatState

// 导出对话为 JSON
export function exportChat(state: ChatState): string {
  console.log('Exporting chat state...', state)
  const exportData = {
    ...state,
    toolResults: Object.fromEntries(state.toolResults)
  }

  return JSON.stringify(exportData, null, 2)
}

// 下载对话为 JSON 文件
export function downloadChat(state: ChatState) {
  const jsonData = exportChat(state)
  const blob = new Blob([jsonData], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `chat-${state.currentSession.title}-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportCurrentChat(toast: ToastServiceMethods) {
  const chatStore = useChatStore()
  console.log(chatStore.messages.length)

  if (chatStore.messages.length === 0) {
    console.log("当前没有可导出的对话")
    toast.add({
      severity: 'warn',
      summary: '提示',
      detail: '当前没有可导出的对话',
      life: 3000
    })
    return
  }

  try {
    downloadChat(chatStore)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '导出失败',
      detail: `导出对话时发生错误: ${error}`,
      life: 5000
    })
  }

}