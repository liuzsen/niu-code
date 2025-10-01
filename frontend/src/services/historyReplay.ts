import type { HistoryLog } from '../types/history_log'
import { messageManager } from './messageManager'

/**
 * 重放历史消息
 */
export async function replayHistoryMessages(chatId: string, historyLogs: HistoryLog[]) {
  // 开始重放模式，避免与实时消息冲突
  messageManager.startReplay()

  try {
    // 按时间顺序重放消息
    const sortedLogs = historyLogs.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    for (const log of sortedLogs) {
      if (log.type == 'user') {
        if (log.message.role == 'user') {
          if (typeof log.message.content == 'string') {
            messageManager.sendUserInput(chatId, log.message.content)
          } else if (log.message.content[0].type == 'text') {
            messageManager.sendUserInput(chatId, log.message.content[0].text)
          } else {
            messageManager.processMessage({
              chat_id: chatId,
              data: {
                kind: 'claude',
                ...log
              }
            })
          }
        }
      } else if (log.type == 'assistant') {
        messageManager.processMessage({
          chat_id: chatId,
          data: {
            kind: 'claude',
            ...log
          }
        })
      }
    }
  } finally {
    // 结束重放模式
    messageManager.endReplay()
  }
}
