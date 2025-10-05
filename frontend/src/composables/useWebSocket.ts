import { inject, provide, type InjectionKey, onMounted, onUnmounted } from 'vue'
import { WebSocketService } from '../services/websocket'

// 定义注入 Key
const WS_INJECTION_KEY: InjectionKey<WebSocketService> = Symbol('websocket')

// 全局单例实例（作为 fallback）
let globalWsInstance: WebSocketService | null = null

/**
 * 提供 WebSocket 实例（在 App.vue 中调用）
 */
export function provideWebSocket() {
  console.log('Providing WebSocket instance')
  // 创建 WebSocket 实例
  const ws = new WebSocketService(`ws://${window.location.host}/api/connect`)

  // 保存为全局实例（作为 inject 的 fallback）
  globalWsInstance = ws

  // 提供给子组件
  provide(WS_INJECTION_KEY, ws)

  // 在组件挂载时连接
  onMounted(async () => {
    try {
      await ws.connect()
      console.log('WebSocket connected on app mount')
    } catch (error) {
      console.error('Failed to connect WebSocket on app mount:', error)
    }
  })

  // 监听页面关闭事件，清理连接
  const cleanup = () => {
    if (ws.state.connected) {
      console.log('Page unloading, disconnecting WebSocket')
      // WebSocket 会在页面关闭时自动断开，这里仅做日志记录
    }
  }

  onMounted(() => {
    window.addEventListener('beforeunload', cleanup)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeunload', cleanup)
  })

  return ws
}

/**
 * 获取 WebSocket 实例
 * 优先使用 inject，如果不可用则使用全局实例
 */
export function useWebSocket(): WebSocketService {
  // 尝试通过 inject 获取
  const ws = inject(WS_INJECTION_KEY, null)

  if (ws) {
    return ws
  }

  // 如果 inject 不可用，使用全局实例
  if (globalWsInstance) {
    return globalWsInstance
  }

  throw new Error('WebSocket not initialized. Make sure provideWebSocket() is called in App.vue')
}
