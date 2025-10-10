export interface PromptRecord {
  content: string
  timestamp: string // ISO 8601 datetime string
  work_dir: string | null
}
