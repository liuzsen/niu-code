import type { ClaudeSession, LoadSessionOptions } from '../types/claude_log'
import type { SessionInfo, MessageRecord } from '../types/session'

// 通用 API 响应类型
export interface ApiOkResponse<T> {
  code: number
  data: T
}

export interface ApiErrorResponse {
  code: number
  error: string
}

export class ApiService {
  constructor() {
  }

  async loadSessions(options: LoadSessionOptions): Promise<ClaudeSession[]> {
    try {
      const url = new URL('/api/load_sessions', window.location.origin)
      url.searchParams.append('options', JSON.stringify(options))

      const response = await fetch(url.toString(), {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiOkResponse<ClaudeSession[]> = await response.json()

      if (result.code !== 0) {
        throw new Error(`API error! code: ${result.code}`)
      }

      return result.data
    } catch (error) {
      console.error('Failed to load sessions:', error)
      throw error
    }
  }

  async getHome(): Promise<string> {
    try {
      const response = await fetch('/api/home_path', {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiOkResponse<string> = await response.json()

      if (result.code !== 0) {
        throw new Error(`API error! code: ${result.code}`)
      }

      return result.data
    } catch (error) {
      console.error('Failed to get home directory:', error)
      throw error
    }
  }

  async ls(dir: string): Promise<string[]> {
    try {
      const url = new URL('/api/ls', window.location.origin)
      url.searchParams.append('dir', dir)

      const response = await fetch(url.toString(), {
        keepalive: true,
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiOkResponse<string[]> = await response.json()

      if (result.code !== 0) {
        throw new Error(`API error! code: ${result.code}`)
      }

      // Extract the string from the tuple structure
      return result.data
    } catch (error) {
      console.error('Failed to list directory:', error)
      throw error
    }
  }

  async loadActiveSessions(workDir: string): Promise<SessionInfo[]> {
    try {
      const url = new URL('/api/active_sessions', window.location.origin)
      url.searchParams.append('work_dir', workDir)

      const response = await fetch(url.toString(), {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiOkResponse<SessionInfo[]> = await response.json()

      if (result.code !== 0) {
        throw new Error(`API error! code: ${result.code}`)
      }

      return result.data
    } catch (error) {
      console.error('Failed to load active sessions:', error)
      throw error
    }
  }

  async reconnectSession(cliId: number, chatId: string): Promise<MessageRecord[]> {
    try {
      const url = new URL('/api/reconnect_session', window.location.origin)
      url.searchParams.append('cli_id', cliId.toString())
      url.searchParams.append('chat_id', chatId)

      const response = await fetch(url.toString(), {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiOkResponse<MessageRecord[]> = await response.json()

      if (result.code !== 0) {
        throw new Error(`API error! code: ${result.code}`)
      }

      return result.data
    } catch (error) {
      console.error('Failed to reconnect session:', error)
      throw error
    }
  }
}

// 默认实例
export const apiService = new ApiService()