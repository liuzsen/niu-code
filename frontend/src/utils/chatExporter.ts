import type { ChatState } from '../stores/chat'

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
