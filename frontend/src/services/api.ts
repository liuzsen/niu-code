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
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:33333') {
    this.baseUrl = baseUrl
  }

  async loadSessions(options: LoadSessionOptions): Promise<ClaudeSession[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/load_sessions`, {
        method: 'GET',
        body: JSON.stringify(options),
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
}

// 默认实例
export const apiService = new ApiService()