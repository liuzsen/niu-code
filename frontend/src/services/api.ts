import type { MessageRecord, UnifiedSessionInfo } from '../types/session'
import type { PermissionMode } from '@anthropic-ai/claude-code'
import type { ClaudeSystemInfo } from '../types/message'
import type { ApiOkResponse, ApiErrorResponse, ApiResponse, AppError } from '../types/error'
import { errorHandler } from './errorHandler'

// Setting types
export interface ClaudeSetting {
  name: string
  setting: Record<string, unknown>
}

export interface Setting {
  claude_settings: ClaudeSetting[]
}

/**
 * 辅助函数：自动处理错误的请求包装
 * @returns 成功返回数据，失败返回 undefined（错误已通过 Toast 显示）
 */
async function requestAndHandle<T>(requestFn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await requestFn()
  } catch (error) {
    if (error && typeof error === 'object' && 'layer' in error) {
      await errorHandler.handle(error as AppError)
    }
    return undefined
  }
}

export class ApiService {
  /**
   * 统一的 HTTP 请求处理（内部方法）
   * @throws {AppError} 失败时抛出错误（由 requestAndHandle 捕获）
   */
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      })

      const data: ApiResponse<T> = await response.json()

      // 成功响应
      if ('code' in data && data.code === 'ok') {
        return (data as ApiOkResponse<T>).data
      }

      // 错误响应
      const errorResp = data as ApiErrorResponse
      const error = errorHandler.createServerError(errorResp.code, errorResp.err)
      throw error

    } catch (err) {
      // 已经是 AppError，直接抛出
      if (err && typeof err === 'object' && 'layer' in err) {
        throw err
      }

      // 网络错误或其他异常
      const networkError = errorHandler.createNetworkError(
        `请求失败: ${url}`,
        err instanceof Error ? err : String(err)
      )
      throw networkError
    }
  }

  async getHome(): Promise<string | undefined> {
    return requestAndHandle(() => this.request<string>('/api/fs/home', { method: 'GET' }))
  }

  async ls(dir: string): Promise<string[] | undefined> {
    const url = new URL('/api/fs/ls', window.location.origin)
    url.searchParams.append('dir', dir)

    return requestAndHandle(() => this.request<string[]>(url.toString(), { keepalive: true, method: 'GET' }))
  }

  async loadSessionList(workDir: string): Promise<UnifiedSessionInfo[] | undefined> {
    const url = new URL('/api/session/list', window.location.origin)
    url.searchParams.append('work_dir', workDir)

    return requestAndHandle(() => this.request<UnifiedSessionInfo[]>(url.toString(), { method: 'GET' }))
  }

  async startChat(options: {
    chat_id: string
    work_dir: string
    mode?: PermissionMode
    config_name?: string
    resume?: string
  }): Promise<MessageRecord[] | undefined> {
    return requestAndHandle(() => this.request<MessageRecord[]>('/api/chat/start', {
      method: 'POST',
      body: JSON.stringify(options)
    }))
  }

  async getSetting(): Promise<Setting | undefined> {
    return requestAndHandle(() => this.request<Setting>('/api/setting', { method: 'GET' }))
  }

  async getConfigNames(): Promise<string[] | undefined> {
    const setting = await this.getSetting()
    if (!setting) return undefined

    return setting.claude_settings.map(cs => cs.name)
  }

  async updateSetting(setting: Setting): Promise<void> {
    await requestAndHandle(() => this.request<void>('/api/setting', {
      method: 'POST',
      body: JSON.stringify(setting)
    }))
  }

  async getClaudeInfo(workDir: string): Promise<ClaudeSystemInfo | undefined> {
    const url = new URL('/api/claude/info', window.location.origin)
    url.searchParams.append('work_dir', workDir)

    return requestAndHandle(() => this.request<ClaudeSystemInfo>(url.toString(), { method: 'GET' }))
  }

  async getWorkspaceFiles(workDir: string): Promise<string[] | undefined> {
    const url = new URL('/api/fs/files', window.location.origin)
    url.searchParams.append('work_dir', workDir)

    return requestAndHandle(() => this.request<string[]>(url.toString(), { method: 'GET' }))
  }
}

export const apiService = new ApiService()
