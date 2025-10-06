import type { ClientMessage, ServerMessage } from '../types/message'
import { errorHandler } from './errorHandler'
import { ErrorSeverity } from '../types/error'

export interface WebSocketError {
  type: 'parse_error' | 'connection_error'
  error: Error
  rawMessage?: string
}

export class WebSocketService {
  private state: "connected" | "connecting" | "reconnecting" | "disconnected" = "disconnected"

  private ws: WebSocket | null = null
  private url: string

  private messageHandlers: Set<(message: ServerMessage) => void> = new Set()
  private connectedHandlers: Set<() => void> = new Set()
  private reconnectionFailedHandlers: Set<() => void> = new Set()

  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 5
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(url: string) {
    this.url = url
  }

  // 状态获取方法
  getConnectionState() {
    return this.state
  }

  isConnected() {
    return this.state === 'connected'
  }

  isConnecting() {
    return this.state === 'connecting'
  }

  isReconnecting() {
    return this.state === 'reconnecting'
  }

  getReconnectAttempt() {
    return this.reconnectAttempts
  }

  onConnected(handler: () => void): () => void {
    this.connectedHandlers.add(handler)
    return () => this.connectedHandlers.delete(handler)
  }

  onReconnectionFailed(handler: () => void): () => void {
    this.reconnectionFailedHandlers.add(handler)
    return () => this.reconnectionFailedHandlers.delete(handler)
  }

  onMessage(handler: (message: ServerMessage) => void): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected() || this.isConnecting()) {
        resolve()
        return
      }

      this.state = 'connecting'

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.state = 'connected'
          this.reconnectAttempts = 0

          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
          }

          this.connectedHandlers.forEach(handler => handler())
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onclose = () => {
          console.warn('WebSocket disconnected')
          this.state = 'disconnected'
          this.ws = null

          this.attemptReconnect()
        }

        this.ws.onerror = (event) => {
          console.error('WebSocket error:', event)
          this.state = 'disconnected'

          // 只在非重连状态下显示错误（避免重复通知）
          if (!this.isReconnecting()) {
            const error = errorHandler.createNetworkError('WebSocket 连接错误')
            errorHandler.handle(error)
          }

          reject(new Error('WebSocket connection error'))
        }
      } catch (error) {
        this.state = 'disconnected'

        const wsError = errorHandler.createNetworkError(
          'WebSocket 创建失败',
          error instanceof Error ? error : String(error)
        )
        errorHandler.handle(wsError)

        reject(error)
      }
    })
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handleReconnectionFailed()
      return
    }

    this.state = 'reconnecting'

    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    console.info(`Reconnecting in ${backoff}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect().catch(error => {
        console.error('Reconnection failed:', error)
      })
    }, backoff)
  }

  private async handleReconnectionFailed(): Promise<void> {
    console.log('Reconnection failed after max attempts')
    this.state = 'disconnected'
    this.reconnectAttempts = 0

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 创建严重错误并通知用户
    const error = errorHandler.createNetworkError('WebSocket 重连失败，请刷新页面')
    error.severity = ErrorSeverity.CRITICAL
    await errorHandler.handle(error)

    this.reconnectionFailedHandlers.forEach(handler => handler())
  }

  sendMessage(message: ClientMessage): void {
    console.log("send message:", message)
    if (!this.isConnected() || !this.ws) {
      throw new Error('WebSocket not connected')
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message: ServerMessage = JSON.parse(event.data)

      this.messageHandlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('Error in message handler:', error)
        }
      })
    } catch (error) {
      console.error('Error parsing server message:', error)
    }
  }
}
