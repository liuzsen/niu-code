/**
 * 统一错误处理服务
 * 职责：分类错误 + Toast 通知用户
 */

import type { AppError, ErrorCode, BizErrorCode } from '../types/error'
import { ErrorLayer, ErrorSeverity, isBizErrorCode, isSystemErrorCode } from '../types/error'

export class ErrorHandler {
  private static instance: ErrorHandler
  private recentErrors = new Map<string, number>()
  private readonly DEDUP_WINDOW = 5000  // 5秒去重窗口

  private constructor() { }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * 主入口：处理错误
   */
  async handle(error: AppError): Promise<void> {
    // 去重检查
    const errorHash = this.hash(error)
    const lastTime = this.recentErrors.get(errorHash)
    const now = Date.now()

    if (lastTime && now - lastTime < this.DEDUP_WINDOW) {
      console.log(`[DEDUP] ${error.title}: ${error.message}`)
      return
    }

    this.recentErrors.set(errorHash, now)
    this.cleanup()

    // 显示 Toast
    await this.showToast(error)

    // 开发环境：打印详细信息
    if (import.meta.env.DEV) {
      this.logToConsole(error)
    }
  }

  /**
   * 创建网络错误
   */
  createNetworkError(
    message: string,
    originalError?: Error | string
  ): AppError {
    return {
      layer: ErrorLayer.NETWORK,
      severity: ErrorSeverity.ERROR,
      code: 'NETWORK_ERROR',
      title: '网络连接失败',
      message,
      technical: originalError instanceof Error ? originalError.message : String(originalError),
      timestamp: new Date()
    }
  }

  /**
   * 创建服务端错误（API/WS 返回的错误）
   */
  createServerError(
    code: string,
    errorMessage?: string
  ): AppError {
    // 类型守卫：已知错误码
    if (isSystemErrorCode(code)) {
      return {
        layer: ErrorLayer.SERVER,
        severity: ErrorSeverity.ERROR,
        code,
        title: '服务器错误',
        message: errorMessage || '服务器内部错误，请稍后重试',
        technical: errorMessage,
        timestamp: new Date()
      }
    }

    if (isBizErrorCode(code)) {
      const { title, message, severity } = this.mapBizError(code, errorMessage)
      return {
        layer: ErrorLayer.SERVER,
        severity,
        code,
        title,
        message,
        technical: errorMessage,
        timestamp: new Date()
      }
    }

    // 未知错误码：兜底策略
    return {
      layer: ErrorLayer.CLIENT,
      severity: ErrorSeverity.ERROR,
      code: 'UNKNOWN_BIZ_ERROR',
      title: '未知错误',
      message: `检测到未知错误码: ${code}，请联系开发者`,
      technical: errorMessage || code,
      timestamp: new Date()
    }
  }

  /**
   * 创建客户端错误
   */
  createClientError(
    code: ErrorCode,
    message: string,
    originalError?: Error | string
  ): AppError {
    return {
      layer: ErrorLayer.CLIENT,
      severity: ErrorSeverity.ERROR,
      code,
      title: '应用错误',
      message,
      technical: originalError instanceof Error ? originalError.message : String(originalError),
      timestamp: new Date()
    }
  }

  /**
   * 业务错误码映射
   */
  private mapBizError(code: BizErrorCode, err?: string): {
    title: string
    message: string
    severity: ErrorSeverity
  } {
    switch (code) {
      case 'chat/not-registerd':
        return {
          title: '会话未注册',
          message: '会话尚未初始化，请重新开始对话',
          severity: ErrorSeverity.WARNING
        }
      case 'chat/config-not-found':
        return {
          title: '配置未找到',
          message: err || '未找到指定的 Claude 配置，请检查配置名称',
          severity: ErrorSeverity.WARNING
        }
    }
  }

  /**
   * 显示 Toast
   */
  private async showToast(error: AppError): Promise<void> {
    const { useGlobalToast } = await import('../stores/toast')
    const toast = useGlobalToast()

    const severityMap = {
      [ErrorSeverity.INFO]: 'info',
      [ErrorSeverity.WARNING]: 'warn',
      [ErrorSeverity.ERROR]: 'error',
      [ErrorSeverity.CRITICAL]: 'error'
    } as const

    const lifeMap = {
      [ErrorSeverity.INFO]: 3000,
      [ErrorSeverity.WARNING]: 5000,
      [ErrorSeverity.ERROR]: 8000,
      [ErrorSeverity.CRITICAL]: 10000
    }

    toast.add({
      severity: severityMap[error.severity],
      summary: error.title,
      detail: error.message,
      life: lifeMap[error.severity],
      closable: error.severity === ErrorSeverity.CRITICAL
    })
  }

  /**
   * 控制台日志（开发环境）
   */
  private logToConsole(error: AppError): void {
    const style = 'font-weight: bold; color: #e74c3c;'
    console.group(`%c[${error.layer.toUpperCase()}] ${error.title}`, style)
    console.log('Code:', error.code)
    console.log('Message:', error.message)
    if (error.technical) console.log('Technical:', error.technical)
    console.log('Timestamp:', error.timestamp.toISOString())
    console.groupEnd()
  }

  /**
   * 错误哈希（用于去重）
   */
  private hash(error: AppError): string {
    return `${error.layer}:${error.code}:${error.title}`
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [hash, time] of this.recentErrors.entries()) {
      if (now - time > this.DEDUP_WINDOW) {
        this.recentErrors.delete(hash)
      }
    }
  }
}

export const errorHandler = ErrorHandler.getInstance()
