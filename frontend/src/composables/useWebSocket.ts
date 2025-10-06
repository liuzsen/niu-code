import { inject, provide, type InjectionKey, onMounted, onUnmounted, reactive, readonly } from 'vue'
import { WebSocketService } from '../services/websocket'

// 定义注入 Key
const WS_INJECTION_KEY: InjectionKey<WebSocketService> = Symbol('websocket')

// 全局单例实例（作为 fallback）
let globalWsInstance: WebSocketService | null = null

// 全局响应式状态
const globalWebSocketState = reactive({
  connected: false,
  connecting: false,
  reconnecting: false,
  reconnectAttempt: 0
})

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

  // 监听连接状态变化
  const updateState = () => {
    globalWebSocketState.connected = ws.isConnected()
    globalWebSocketState.connecting = ws.isConnecting()
    globalWebSocketState.reconnecting = ws.isReconnecting()
    globalWebSocketState.reconnectAttempt = ws.getReconnectAttempt()
  }

  // 监听连接成功事件
  ws.onConnected(updateState)

  // 监听重连失败事件
  ws.onReconnectionFailed(updateState)

  // 在组件挂载时连接
  onMounted(async () => {
    try {
      await ws.connect()
      console.log('WebSocket connected on app mount')
      updateState()
    } catch (error) {
      console.error('Failed to connect WebSocket on app mount:', error)
    }
  })

  // 监听页面关闭事件，清理连接
  const cleanup = () => {
    if (ws.isConnected()) {
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
export function useWebSocket() {
  // 尝试通过 inject 获取
  const ws = inject(WS_INJECTION_KEY, null)

  if (ws) {
    return {
      ws,
      state: readonly(globalWebSocketState)
    }
  }

  // 如果 inject 不可用，使用全局实例
  if (globalWsInstance) {
    return {
      ws: globalWsInstance,
      state: readonly(globalWebSocketState)
    }
  }

  throw new Error('WebSocket not initialized. Make sure provideWebSocket() is called in App.vue')
}
