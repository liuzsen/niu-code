import { reactive } from 'vue'
import type { ClientMessage, ServerMessage } from '../types/index'
import { loadMockData } from './mock-loader'
import { createAgentMessage, createUserMessage } from '../types/chat'
import { useChatStore } from '../stores/chat'

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
  private chatStore: ReturnType<typeof useChatStore> | null = null

  public state = reactive<WebSocketState>({
    connected: false,
    connecting: false,
    error: null
  })

  constructor(url: string) {
    this.url = url
  }

  // 延迟获取 store，确保 Pinia 已经初始化
  private getChatStore() {
    if (!this.chatStore) {
      this.chatStore = useChatStore()
    }
    return this.chatStore
  }

  useMock() {
    this.state.connected = true;
    const messages = loadMockData();
    const store = this.getChatStore()
    for (const message of messages) {
      store.processMessage(message)
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // this.useMock()

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
          try {
            const message: ServerMessage = JSON.parse(event.data)
            this.handleServerMessage(message)
          } catch (error) {
            console.error('Error parsing server message:', error)
          }
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
          reject(error)
        }
      } catch (error) {
        this.state.connecting = false
        this.state.error = 'Failed to create connection'
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

  sendUserInput(content: string): void {
    const message: ClientMessage = {
      type: 'user_input',
      content,
    }

    this.sendMessage(message);
    this.getChatStore().processMessage(createUserMessage(content));
  }

  private handleServerMessage(message: ServerMessage) {
    console.log('Received server message:', message)
    this.getChatStore().processMessage(createAgentMessage(message))
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.state.error = 'Max reconnection attempts reached'
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
export const wsService = new WebSocketService('ws://localhost:33333')