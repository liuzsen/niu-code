import { useChatManager } from '../stores/chat'
import { useGlobalToast } from '../stores/toast'

export function exportCurrentChat() {
  const chatManager = useChatManager()
  const foregroundChat = chatManager.foregroundChat
  console.log(foregroundChat.messages.length)

  if (foregroundChat.messages.length === 0) {
    console.log("当前没有可导出的对话")
    useGlobalToast().add({
      severity: 'warn',
      summary: '提示',
      detail: '当前没有可导出的对话',
      life: 3000
    })
    return
  }

  try {
    // 将 Map 转换为普通对象以便序列化
    const exportData = {
      ...foregroundChat,
      toolResults: Object.fromEntries(foregroundChat.toolResults)
    }
    const jsonData = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `chat-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    useGlobalToast().add({
      severity: 'error',
      summary: '导出失败',
      detail: `导出对话时发生错误: ${error}`,
      life: 5000
    })
  }
}