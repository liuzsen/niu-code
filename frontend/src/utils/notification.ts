import { useGlobalToast } from '../stores/toast'

// ===== 标题闪动状态管理 =====
let originalTitle: string = document.title
let flashingInterval: number | null = null
let isFlashing = false

/**
 * 开始标题闪动
 * @param notificationTitle 通知标题（将与原标题交替显示）
 * @param interval 闪动间隔（毫秒），默认 1000ms
 */
export function startTitleFlashing(notificationTitle: string, interval: number = 300) {
  // 如果已在闪动，先停止
  if (isFlashing) {
    stopTitleFlashing()
  }

  // 保存原标题
  originalTitle = document.title
  isFlashing = true

  let showNotification = true
  flashingInterval = window.setInterval(() => {
    document.title = showNotification ? `🔔 ${notificationTitle}` : originalTitle
    showNotification = !showNotification
  }, interval)

  // 监听页面可见性变化，用户回到页面时停止闪动
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

/**
 * 停止标题闪动并恢复原标题
 */
export function stopTitleFlashing() {
  if (flashingInterval !== null) {
    clearInterval(flashingInterval)
    flashingInterval = null
  }

  if (isFlashing) {
    document.title = originalTitle
    isFlashing = false
  }

  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

/**
 * 处理页面可见性变化
 */
function handleVisibilityChange() {
  // 用户回到页面时停止闪动
  if (document.visibilityState === 'visible' && isFlashing) {
    stopTitleFlashing()
  }
  if (document.visibilityState === 'visible' && isIconBlinking) {
    stopIconBlinking()
  }
}

// ===== 图标闪动状态管理 =====
const originalFavicon: string = '/vite.svg'
let iconBlinkingInterval: number | null = null
let isIconBlinking = false
let notificationIcon: string | null = null

/**
 * 生成带通知标识的图标
 * @param badgeText 通知文字（如红点、数字）
 * @returns Promise<string> 返回 generated icon data URL
 */
async function generateNotificationIcon(badgeText: string = '🔴'): Promise<string> {
  try {
    // 创建 canvas 元素
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Canvas context not available')
    }

    // 设置 Canvas 尺寸（标准 favicon 尺寸）
    canvas.width = 32
    canvas.height = 32

    // 创建图像对象加载原始图标
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.crossOrigin = 'anonymous'
      img.src = originalFavicon
    })

    // 绘制原始图标
    ctx.drawImage(img, 0, 0, 32, 32)

    // 绘制通知红点（右上角）
    const badgeSize = 12
    const x = 32 - badgeSize - 2
    const y = 2

    // 绘制红色圆形背景
    ctx.fillStyle = '#ff4444'
    ctx.beginPath()
    ctx.arc(x + badgeSize / 2, y + badgeSize / 2, badgeSize / 2, 0, 2 * Math.PI)
    ctx.fill()

    // 如果是数字，绘制白色文字
    if (badgeText.match(/^\d$/)) {
      ctx.fillStyle = 'white'
      ctx.font = 'bold 8px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(badgeText, x + badgeSize / 2, y + badgeSize / 2)
    }

    // 返回 data URL
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.warn('生成通知图标失败:', error)
    // 降级：返回原图标
    return originalFavicon
  }
}

/**
 * 更新页面图标
 * @param iconUrl 图标 URL 或 data URL
 */
function updateFavicon(iconUrl: string) {
  try {
    // 获取现有的 link 元素或创建新的
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }

    // 设置正确的类型和尺寸
    link.type = 'image/png'
    link.sizes = '32x32'

    // 更新 href
    link.href = iconUrl
  } catch (error) {
    console.warn('更新图标失败:', error)
  }
}

/**
 * 检查 Canvas 支持性
 */
function isCanvasSupported(): boolean {
  try {
    return !!document.createElement('canvas').getContext
  } catch {
    return false
  }
}

/**
 * 简单的图标切换降级方案（无 Canvas）
 * @param useNotificationIcon 是否使用通知图标
 */
function simpleIconToggle(useNotificationIcon: boolean = false) {
  try {
    if (useNotificationIcon && !isCanvasSupported()) {
      // 如果不支持 Canvas，使用简单的emoji作为图标
      const emojiToDataURL = (): string => {
        // 创建一个简单的白底黑字的emoji图标
        return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gECEhgLtKmwxgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAEl0lEQVRYw82Xa0/VRRzHv7uW1nZ0uQIYyCCoFUBwUK4cK0uQYTDKjxQcQXVu8AO4MPwPuEP4BD+BVw/AXwO7gP7gP6sYFExYtEQhRJ+iFKFqTHPxkqk03bW7t/P6/l/7dvdOQUEkWL7WXufe87ff+33nO89AR6e/C4wGLgInAO8APwNXAcOAnh4sA7l4BZwEbgseA3wLfAuOAzsB24FtgAvF8gzE/AWOAWsB+4BfgS84CjgUPA9mAMvAL8AhwFbgPmAN9M1FQLAlrnE78Ao8DywHlgCvANMAxwDTA+CzwIPX39DgP2AI8DbwEvAAUAW4Cg93PQPwNOPAPuAeOArcAfSF5FKnEkMJOAR4FpgNfAJEgbvAF8FNgIvBk4BdqxENwA/DfQNcM/wAmA5MB0oCtwJ2AWeBxyBEOQm8CvxTPJgAGJrLAP2aAd4HrgSKgNHAvkgrto/T1wFHALzJjJNtATxkn+DiIvAOMOGxL7AYuBvoC9wEvAteMDXpAY8D5wCuCiPcT/APdiAB4iDiQmAfuAxyATGrC/DPyLwO2JyJLACKRkQuqYg8BLaJyJp1bUT8CFxzn8TKF5HnEfkU8A9xyBSwTLAP6DPgkIisHvwBeKSFoAGdGxOIicgVwLHG8hKAlxAStSRcCIIIkgZdTV55d0Af4LWARMBT4Hrga2AZOBBSBfzNwAllSqgfYA/5tUHRfrAB2JSKfRORX3qT6onIleK2JvAkckyklgSMLGf2AzwEJkd4kwCeIOI/DCxG7gJQEQ+L8/yNrAHqVaJibtA96/1NEXgNYCSykXlZcQCn1BvA+06CJiJ7Q0vINBtYClwi1UZKHwHwJDC3Geh34JeJya2Z+BbAB2IgDFUVSHwCwBLCbxP3CeLc6Ikq2923dGG6ivXwSNjN02wuUVUNrAX+CvpPnLIP7vgF/ge2ICAAf1nJG+1q1VYLIJzrVV146d6zVwBrAj8CCyHyRuSRV9AF8GzAD8CgDHD42p/5d9w0Lln4P+Y2qDVrF8Vn9Yj54wtb6ls/2tBu16yCyiERVFMhTRZ8BkIin7+VAHVECpZLbpLiLNSVYMyK/GKUx4onMvegElUbYgM/Ble6fsA/1+Ncv7FHcuRHwBWAF+IqFYfB459A7gUGGjyuyRyvqicA0ckvR9ElM1fbKfKSSZUA1XRvwlGk3yfaAU7Afur3ZkXM4b//S8XZAG6JyFsLG+sPfL+I3AK8EGhHVSWcqn/3jv/nQATDSMmSgMxFOpdnXx1kxP/JmgMzZ0j8B6z44i4SMPPAAAAAElFTkSuQmCC`
      }

      updateFavicon(useNotificationIcon ? emojiToDataURL() : originalFavicon)
    }
  } catch (error) {
    console.warn('简单图标切换失败:', error)
  }
}

/**
 * 开始图标闪动
 * @param notificationText 通知标识文字
 * @param interval 闪动间隔（毫秒），默认 1000ms
 */
export async function startIconBlinking(notificationText: string = '🔴', interval: number = 1000) {
  // 如果已在闪动，先停止
  if (isIconBlinking) {
    stopIconBlinking()
  }

  isIconBlinking = true

  // 检查 Canvas 支持
  if (!isCanvasSupported()) {
    console.info('不支持 Canvas，使用简单图标切换')

    let showNotification = true
    iconBlinkingInterval = window.setInterval(() => {
      simpleIconToggle(showNotification)
      showNotification = !showNotification
    }, interval)

    return
  }

  // 生成通知图标
  try {
    notificationIcon = await generateNotificationIcon(notificationText)
  } catch {
    console.warn('生成通知图标失败，使用原图标')
    notificationIcon = originalFavicon
  }

  let showNotification = true
  iconBlinkingInterval = window.setInterval(() => {
    try {
      updateFavicon(showNotification ? notificationIcon || originalFavicon : originalFavicon)
    } catch (error) {
      console.warn('图标切换失败:', error)
    }
    showNotification = !showNotification
  }, interval)

  // 监听页面可见性变化（与标题闪动共用同一个监听器）
}

/**
 * 停止图标闪动并恢复原始图标
 */
export function stopIconBlinking() {
  if (iconBlinkingInterval !== null) {
    try {
      clearInterval(iconBlinkingInterval)
    } catch (error) {
      console.warn('清除图标配定时器失败:', error)
    }
    iconBlinkingInterval = null
  }

  if (isIconBlinking) {
    try {
      updateFavicon(originalFavicon)
    } catch (error) {
      console.warn('恢复原始图标失败:', error)
    }
    isIconBlinking = false
    notificationIcon = null
  }
}

// ===== 通知权限和检测 =====

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

  // 用户不在页面时，同时启动标题和图标闪动
  if (!isUserActive()) {
    startTitleFlashing(title)
    startIconBlinking() // 默认红点闪动
  }

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
        icon: '/vite.svg', // 使用实际存在的图标文件
        badge: '/vite.svg', // 使用实际存在的图标文件
        tag, // 防止重复通知堆叠
        silent: false,
        requireInteraction: false // 自动消失
      })

      // 点击通知时聚焦窗口并停止标题和图标闪动
      notification.onclick = () => {
        window.focus()
        notification.close()
        stopTitleFlashing()
        stopIconBlinking()
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
