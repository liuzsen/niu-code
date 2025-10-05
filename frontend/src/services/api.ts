import type { ClaudeSession, LoadSessionOptions } from '../types/claude_log'
import type { SessionInfo, MessageRecord, UnifiedSessionInfo } from '../types/session'
import type { PermissionMode } from '@anthropic-ai/claude-code'
import type { ClaudeSystemInfo } from '../types/message'

// Setting types
export interface ClaudeSetting {
  name: string
  setting: Record<string, unknown> // JSON Value
}

export interface Setting {
  claude_settings: ClaudeSetting[]
}

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
      const response = await fetch('/api/fs/home', {
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
      const url = new URL('/api/fs/ls', window.location.origin)
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

  // 新的统一 API：加载会话列表
  async loadSessionList(workDir: string): Promise<UnifiedSessionInfo[]> {
    try {
      const url = new URL('/api/session/list', window.location.origin)
      url.searchParams.append('work_dir', workDir)

      const response = await fetch(url.toString(), {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiOkResponse<UnifiedSessionInfo[]> = await response.json()

      if (result.code !== 0) {
        throw new Error(`API error! code: ${result.code}`)
      }

      return result.data
    } catch (error) {
      console.error('Failed to load session list:', error)
      throw error
    }
  }

  // 新的统一 API：开始会话（支持 resume）
  async startChat(options: {
    chat_id: string
    work_dir: string
    mode?: PermissionMode
    config_name?: string
    resume?: string
  }): Promise<MessageRecord[]> {
    try {
      const response = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
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
      console.error('Failed to start chat:', error)
      throw error
    }
  }

  // Setting API
  async getSetting(): Promise<Setting> {
    try {
      const response = await fetch('/api/setting', {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiOkResponse<Setting> = await response.json()

      if (result.code !== 0) {
        throw new Error(`API error! code: ${result.code}`)
      }

      return result.data
    } catch (error) {
      console.error('Failed to get setting:', error)
      throw error
    }
  }

  async getConfigNames(): Promise<string[]> {
    try {
      const setting = await this.getSetting()
      return setting.claude_settings.map(cs => cs.name)
    } catch (error) {
      console.error('Failed to get config names:', error)
      throw error
    }
  }

  async updateSetting(setting: Setting): Promise<void> {
    try {
      const response = await fetch('/api/setting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(setting)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiOkResponse<void> = await response.json()

      if (result.code !== 0) {
        throw new Error(`API error! code: ${result.code}`)
      }
    } catch (error) {
      console.error('Failed to update setting:', error)
      throw error
    }
  }

  async getClaudeInfo(workDir: string): Promise<ClaudeSystemInfo> {
    try {
      const url = new URL('/api/claude/info', window.location.origin)
      url.searchParams.append('work_dir', workDir)

      const response = await fetch(url.toString(), {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiOkResponse<ClaudeSystemInfo> = await response.json()

      if (result.code !== 0) {
        throw new Error(`API error! code: ${result.code}`)
      }

      return result.data
    } catch (error) {
      console.error('Failed to get Claude info:', error)
      throw error
    }
  }

  async getWorkspaceFiles(): Promise<string[]> {
    // Mock data - 模拟工作目录下的文件列表
    return [
      'frontend/src/App.vue',
      'frontend/src/main.ts',
      'frontend/src/style.css',
      'frontend/src/components/ChatPanel.vue',
      'frontend/src/components/InputEditor.vue',
      'frontend/src/components/slash-commands/SlashCommandsExtension.ts',
      'frontend/src/components/slash-commands/SlashCommandSuggestion.ts',
      'frontend/src/components/slash-commands/SlashCommandList.vue',
      'frontend/src/services/api.ts',
      'frontend/src/services/websocket.ts',
      'frontend/src/services/messageManager.ts',
      'frontend/src/stores/chatManager.ts',
      'frontend/src/types/message.ts',
      'frontend/src/types/session.ts',
      'frontend/package.json',
      'frontend/vite.config.ts',
      'frontend/tsconfig.json',
      'backend/src/main.rs',
      'backend/src/api.rs',
      'backend/src/api/chat.rs',
      'backend/src/api/fs.rs',
      'backend/src/api/setting.rs',
      'backend/Cargo.toml',
      'README.md',
      'CLAUDE.md',
      'architecture.md',
    ]
  }

  // === 下面是旧的废弃方法，将在后续清理 ===

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