// 文件更新事件类型
export interface FileUpdateEvent {
  type: 'FileCreated' | 'FileRemoved' | 'Error'
  work_dir: string
  file?: string
  message?: string
}

export class FileUpdateService {
  private eventSource: EventSource | null = null
  private fileChangeCallbacks: Set<(type: 'created' | 'removed', file: string) => void> = new Set()
  private errorCallbacks: Set<(error: string) => void> = new Set()
  private currentWorkDir: string = ''

  // 订阅文件更新
  subscribe(workDir: string, options: {
    onFileChange?: (type: 'created' | 'removed', file: string) => void
    onError?: (error: string) => void
  }): () => void {
    // 如果是新的工作目录，重新建立连接
    if (this.currentWorkDir !== workDir) {
      this.disconnect()
      this.currentWorkDir = workDir
      this.connect(workDir)
    }

    // 添加回调函数
    if (options.onFileChange) {
      this.fileChangeCallbacks.add(options.onFileChange)
    }
    if (options.onError) {
      this.errorCallbacks.add(options.onError)
    }

    // 返回取消订阅函数
    return () => {
      if (options.onFileChange) {
        this.fileChangeCallbacks.delete(options.onFileChange)
      }
      if (options.onError) {
        this.errorCallbacks.delete(options.onError)
      }

      // 如果没有订阅者了，断开连接
      if (this.fileChangeCallbacks.size === 0) {
        this.disconnect()
      }
    }
  }

  private connect(workDir: string) {
    try {
      const url = new URL('/api/fs/updates', window.location.origin)
      url.searchParams.append('work_dir', workDir)

      console.log('Connecting to file updates SSE for workDir:', workDir)

      this.eventSource = new EventSource(url.toString())

      this.eventSource.onopen = () => {
        console.log('File updates SSE connection opened for workDir:', workDir)
      }

      this.eventSource.onmessage = (event) => {
        try {
          const data: FileUpdateEvent = JSON.parse(event.data)

          console.log('Received file update event:', data)

          switch (data.type) {
            case 'FileCreated':
              if (data.file) {
                console.log('File created:', data.file)
                this.fileChangeCallbacks.forEach(callback => {
                  try {
                    callback('created', data.file!)
                  } catch (error) {
                    console.error('Error in file change callback:', error)
                  }
                })
              }
              break

            case 'FileRemoved':
              if (data.file) {
                console.log('File removed:', data.file)
                this.fileChangeCallbacks.forEach(callback => {
                  try {
                    callback('removed', data.file!)
                  } catch (error) {
                    console.error('Error in file change callback:', error)
                  }
                })
              }
              break

  
            case 'Error':
              if (data.message) {
                console.error('File update error for workDir:', data.work_dir, 'error:', data.message)
                this.errorCallbacks.forEach(callback => {
                  try {
                    callback(data.message!)
                  } catch (error) {
                    console.error('Error in file update error callback:', error)
                  }
                })
              }
              break
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', event.data, error)
        }
      }

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)

        // 通知所有错误回调
        this.errorCallbacks.forEach(callback => {
          try {
            callback('SSE connection error')
          } catch (error) {
            console.error('Error in file update error callback:', error)
          }
        })

        // 如果连接关闭，尝试重新连接
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed, attempting to reconnect...')
          setTimeout(() => {
            if (this.fileChangeCallbacks.size > 0 && this.currentWorkDir) {
              this.connect(this.currentWorkDir)
            }
          }, 3000) // 3秒后重连
        }
      }
    } catch (error) {
      console.error('Failed to create SSE connection:', error)

      // 通知所有错误回调
      this.errorCallbacks.forEach(callback => {
        try {
          callback('Failed to create SSE connection')
        } catch (error) {
          console.error('Error in file update error callback:', error)
        }
      })
    }
  }

  private disconnect() {
    if (this.eventSource) {
      console.log('Disconnecting from file updates SSE')
      this.eventSource.close()
      this.eventSource = null
    }
    this.currentWorkDir = ''
  }

  // 手动重新连接
  reconnect(): void {
    if (this.currentWorkDir && this.fileChangeCallbacks.size > 0) {
      this.disconnect()
      this.connect(this.currentWorkDir)
    }
  }

  // 获取连接状态
  get connected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }

  // 获取当前工作目录
  get currentWorkDirectory(): string {
    return this.currentWorkDir
  }
}

// 默认实例
export const fileUpdateService = new FileUpdateService()