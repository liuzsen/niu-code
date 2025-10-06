/**
 * 播放通知声音
 * 使用音频文件播放提示音
 */
export function playNotificationSound() {
  try {
    const audio = new Audio('/finished.mp3')
    audio.volume = 0.7 // 设置音量（0.0 到 1.0）
    audio.play().catch(error => {
      console.warn('播放通知声音失败:', error)
    })
  } catch (error) {
    console.warn('播放通知声音失败:', error)
  }
}
