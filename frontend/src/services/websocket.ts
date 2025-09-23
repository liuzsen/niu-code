import { reactive } from 'vue'
import type { ClientMessage, ServerMessage, WebSocketError } from '../types/message'

interface WebSocketState {
  connected: boolean
  connecting: boolean
  error: string | null
}

export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  // 类型安全的消息处理器
  private messageHandlers: Set<(message: ServerMessage) => void> = new Set()
  private errorHandlers: Set<(error: WebSocketError) => void> = new Set()

  public state = reactive<WebSocketState>({
    connected: false,
    connecting: false,
    error: null
  })

  constructor(url: string) {
    this.url = url
  }

  // 注册消息处理器
  onMessage(handler: (message: ServerMessage) => void): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  // 注册错误处理器
  onError(handler: (error: WebSocketError) => void): () => void {
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state.connected || this.state.connecting) {
        resolve()
        return
      }

      this.state.connecting = true
      this.state.error = null

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.state.connected = true
          this.state.connecting = false
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onclose = () => {
          console.log('WebSocket disconnected')
          this.state.connected = false
          this.state.connecting = false
          this.ws = null
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.state.error = 'Connection error'
          this.state.connecting = false

          // 通知错误处理器
          this.errorHandlers.forEach(handler => {
            handler({
              type: 'connection_error',
              error: error instanceof Error ? error : new Error(String(error))
            })
          })

          reject(error)
        }
      } catch (error) {
        this.state.connecting = false
        this.state.error = 'Failed to create connection'

        // 通知错误处理器
        this.errorHandlers.forEach(handler => {
          handler({
            type: 'connection_error',
            error: error instanceof Error ? error : new Error(String(error))
          })
        })

        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.state.connected = false
    this.state.connecting = false
  }

  // 发送消息 - 纯网络通信，不处理业务逻辑
  sendMessage(message: ClientMessage): void {
    if (!this.state.connected || !this.ws) {
      throw new Error('WebSocket not connected')
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  // 处理接收的消息
  private handleMessage(event: MessageEvent) {
    try {
      const message: ServerMessage = JSON.parse(event.data)

      // 调用所有消息处理器
      this.messageHandlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('Error in message handler:', error)
        }
      })
    } catch (error) {
      console.error('Error parsing server message:', error)

      // 通知错误处理器
      this.errorHandlers.forEach(handler => {
        handler({
          type: 'parse_error',
          error: error instanceof Error ? error : new Error(String(error)),
          rawMessage: event.data
        })
      })
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.state.error = 'Max reconnection attempts reached'

      // 通知错误处理器
      this.errorHandlers.forEach(handler => {
        handler({
          type: 'connection_error',
          error: new Error('Max reconnection attempts reached')
        })
      })

      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts

    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error)
      })
    }, delay)
  }
}

// Global instance
export const wsService = new WebSocketService('ws://localhost:33333/api/connect')