// === 后端错误码（与 backend/src/api.rs 一一对应）===
export const BizErrorCode = [
  'chat/not-registerd',
  'chat/config-not-found'
] as const

export const SystemErrorCode = [
  'SYSTEM_ERROR'
] as const

export type BizErrorCode = typeof BizErrorCode[number]
export type SystemErrorCode = typeof SystemErrorCode[number]
export type ServerErrorCode = BizErrorCode | SystemErrorCode

// === 前端错误码 ===
export type ClientErrorCode =
  | 'NETWORK_ERROR'        // 网络连接错误
  | 'UNKNOWN_BIZ_ERROR'    // 未知的业务错误码（兜底）
  | 'CLIENT_ERROR'         // 客户端错误

export type ErrorCode = ServerErrorCode | ClientErrorCode

// === API 响应类型 ===
export interface ApiOkResponse<T> {
  code: 'ok'
  data: T
}

export interface ApiErrorResponse {
  code: string  // 运行时验证
  err?: string
}

export type ApiResponse<T> = ApiOkResponse<T> | ApiErrorResponse

// === 错误层级 ===
export const ErrorLayer = {
  NETWORK: 'network',   // 网络错误
  SERVER: 'server',     // 服务端错误（API/WS 返回）
  CLIENT: 'client'      // 客户端错误
} as const

export type ErrorLayer = typeof ErrorLayer[keyof typeof ErrorLayer]

// === 错误严重性 ===
export const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
} as const

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity]

// === 应用错误统一接口 ===
export interface AppError {
  layer: ErrorLayer
  severity: ErrorSeverity
  code: ErrorCode
  title: string          // Toast 标题
  message: string        // Toast 详细信息（用户可读）
  technical?: string     // 技术细节（开发环境显示）
  timestamp: Date
}

// === 通用类型守卫工具 ===
function isValueOfArray<T extends readonly string[]>(arr: T) {
  return (code: string): code is T[number] => {
    return arr.includes(code as T[number])
  }
}

// === 类型守卫 ===
export const isBizErrorCode = isValueOfArray(BizErrorCode)
export const isSystemErrorCode = isValueOfArray(SystemErrorCode)

export function isServerErrorCode(code: string): code is ServerErrorCode {
  return isBizErrorCode(code) || isSystemErrorCode(code)
}
