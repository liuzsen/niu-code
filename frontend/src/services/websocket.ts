import { ref, reactive } from 'vue'
import type { ClientMessage, ServerMessage } from '../../../backend/src/types/index'
import type { Message } from '../types/message'

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

  public state = reactive<WebSocketState>({
    connected: false,
    connecting: false,
    error: null
  })

  public messages = ref<Message[]>([])

  constructor(url: string) {
    this.url = url
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
    this.messages.value.push({
      role: 'user',
      content,
      timestamp: Date.now()
    })

    const message: ClientMessage = {
      type: 'user_input',
      data: { content }
    }

    this.sendMessage(message)
  }

  startSession(): void {
    const message: ClientMessage = {
      type: 'start_session',
      data: { timestamp: new Date().toISOString() }
    }

    this.sendMessage(message)
  }

  private handleServerMessage(message: ServerMessage): void {
    console.log('Received server message:', message)

    switch (message.type) {
      case 'claude_message':
        this.messages.value.push({
          role: 'assistant',
          content: message.data.content,
          timestamp: Date.now()
        })
        break

      case 'session_started':
        this.messages.value.push({
          role: 'assistant',
          content: `Session started: ${message.data.message}`,
          timestamp: Date.now()
        })
        break

      case 'error':
        this.messages.value.push({
          role: 'assistant',
          content: `Error: ${message.data.message}`,
          timestamp: Date.now()
        })
        this.state.error = message.data.message
        break

      default:
        console.log('Unknown server message type:', message.type)
    }
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