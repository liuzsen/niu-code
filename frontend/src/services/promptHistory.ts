import type { PromptRecord } from '../types/prompt'

export class PromptHistoryService {
  private eventSource: EventSource | null = null
  private promptCallbacks: Set<(record: PromptRecord) => void> = new Set()
  private errorCallbacks: Set<(error: string) => void> = new Set()

  // Subscribe to prompt history updates
  subscribe(options: {
    onPromptReceived?: (record: PromptRecord) => void
    onError?: (error: string) => void
  }): () => void {
    // If not connected, establish connection
    if (!this.eventSource) {
      this.connect()
    }

    // Add callback functions
    if (options.onPromptReceived) {
      this.promptCallbacks.add(options.onPromptReceived)
    }
    if (options.onError) {
      this.errorCallbacks.add(options.onError)
    }

    // Return unsubscribe function
    return () => {
      if (options.onPromptReceived) {
        this.promptCallbacks.delete(options.onPromptReceived)
      }
      if (options.onError) {
        this.errorCallbacks.delete(options.onError)
      }

      // If no subscribers left, disconnect
      if (this.promptCallbacks.size === 0) {
        this.disconnect()
      }
    }
  }

  private connect() {
    try {
      const url = new URL('/api/chat/prompts', window.location.origin)

      console.log('Connecting to prompt history SSE:', url.toString())

      this.eventSource = new EventSource(url.toString())

      this.eventSource.onopen = () => {
        console.log('Prompt history SSE connection opened')
      }

      this.eventSource.onmessage = (event) => {
        try {
          const record: PromptRecord = JSON.parse(event.data)

          console.log('Received prompt record:', record)

          // Notify all prompt callbacks
          this.promptCallbacks.forEach(callback => {
            try {
              callback(record)
            } catch (error) {
              console.error('Error in prompt callback:', error)
            }
          })
        } catch (error) {
          console.error('Failed to parse prompt record:', event.data, error)
        }
      }

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)

        // Notify all error callbacks
        this.errorCallbacks.forEach(callback => {
          try {
            callback('SSE connection error')
          } catch (error) {
            console.error('Error in prompt error callback:', error)
          }
        })

        // If connection closed, attempt to reconnect
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed, attempting to reconnect...')
          setTimeout(() => {
            if (this.promptCallbacks.size > 0) {
              this.connect()
            }
          }, 3000) // Reconnect after 3 seconds
        }
      }
    } catch (error) {
      console.error('Failed to create SSE connection:', error)

      // Notify all error callbacks
      this.errorCallbacks.forEach(callback => {
        try {
          callback('Failed to create SSE connection')
        } catch (error) {
          console.error('Error in prompt error callback:', error)
        }
      })
    }
  }

  private disconnect() {
    if (this.eventSource) {
      console.log('Disconnecting from prompt history SSE')
      this.eventSource.close()
      this.eventSource = null
    }
  }

  // Get connection status
  get connected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }
}

// Singleton instance
export const promptHistoryService = new PromptHistoryService()
