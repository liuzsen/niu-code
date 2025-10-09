import { useGlobalToast } from '../stores/toast'

/**
 * 请求浏览器通知权限
 * 在应用启动时调用，提前获取用户授权
 * @returns 返回权限状态 ('granted' | 'denied' | 'default')
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  // 检查浏览器是否支持通知
  if (!('Notification' in window)) {
    console.warn('浏览器不支持通知')
    return 'denied'
  }

  try {
    // 如果尚未请求过权限，则请求
    if (Notification.permission === 'default') {
      return await Notification.requestPermission()
    }
    return Notification.permission
  } catch (error) {
    console.warn('请求通知权限失败:', error)
    return 'denied'
  }
}

/**
 * 检测用户是否在页面活跃
 * @returns true 表示用户在页面活跃（页面可见且获得焦点）
 */
export function isUserActive(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus()
}

/**
 * 播放音频文件通知声音
 * 使用音频文件播放提示音
 */
export function playFinishedNotificationSound() {
  try {
    const audio = new Audio('/finished.mp3')
    audio.volume = 0.5 // 设置音量（0.0 到 1.0）
    audio.play().catch(error => {
      console.warn('播放通知声音失败:', error)
    })
  } catch (error) {
    console.warn('播放通知声音失败:', error)
  }
}

/**
 * 使用 Web Audio API 生成简单的 ding 音效
 */
export function playDingSound() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // 设置音调（800Hz 产生清脆的 ding 声）
    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    // 设置音量渐变（快速淡出）
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

    // 播放 0.3 秒
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch (error) {
    console.warn('播放 ding 声音失败:', error)
  }
}

/**
 * 发送浏览器通知（通用函数）
 * @param title 通知标题
 * @param body 通知内容
 * @param tag 通知标签，用于防止重复通知堆叠
 */
function sendBrowserNotification(title: string, body: string, tag: string) {
  console.log('发送通知:', title)
  // 检查浏览器是否支持通知
  if (!('Notification' in window)) {
    console.warn('浏览器不支持通知')
    return
  }

  try {
    // 仅在已授权时发送通知
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag, // 防止重复通知堆叠
        requireInteraction: false // 自动消失
      })

      // 点击通知时聚焦窗口
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } else {
      console.warn('用户未授权通知')
    }
  } catch (error) {
    console.warn('发送通知失败:', error)
  }
}

/**
 * 发送任务完成的浏览器通知
 */
export function sendTaskCompletedNotification() {
  sendBrowserNotification('任务完成', 'Claude 已完成当前任务', 'claude-task-completed')
}

/**
 * 发送计划批准请求的浏览器通知
 */
export function sendPlanApprovalNotification() {
  sendBrowserNotification('需要批准计划', 'Claude 已完成计划，请查看并批准', 'claude-plan-approval')
}

/**
 * 发送工具权限请求的浏览器通知
 * @param toolName 工具名称
 */
export function sendToolPermissionNotification(toolName: string) {
  sendBrowserNotification(
    '需要工具权限',
    `Claude 请求使用 ${toolName} 工具`,
    'claude-tool-permission'
  )
}

/**
 * 显示任务完成通知
 * - 如果用户在页面活跃：显示 toast（不自动关闭）
 * - 如果用户不在页面活跃：播放声音 + 浏览器通知
 */
export function notifyTaskCompleted() {
  // 用户在页面，显示温和的 toast
  const toast = useGlobalToast()
  toast.add({
    severity: 'success',
    summary: '任务完成',
    detail: 'Claude 已完成当前任务',
    life: 2000
  })

  if (!isUserActive()) {
    // 用户不在页面，使用声音和浏览器通知
    playFinishedNotificationSound()
    sendTaskCompletedNotification()
  }
}
