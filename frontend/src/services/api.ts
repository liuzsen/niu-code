import type { ClaudeSession, LoadSessionOptions } from '../types/claude_log'

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
}

// 默认实例
export const apiService = new ApiService()