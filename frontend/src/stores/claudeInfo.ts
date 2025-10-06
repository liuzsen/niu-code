import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ClaudeSystemInfo } from '../types/message'
import { apiService } from '../services/api'

export const useClaudeInfo = defineStore('claude-info', () => {
  const systemInfo = ref<ClaudeSystemInfo | null>(null)

  const loadClaudeInfo = async (workDir: string) => {
    const info = await apiService.getClaudeInfo(workDir)
    systemInfo.value = info || null
    return info
  }

  const clearClaudeInfo = () => {
    systemInfo.value = null
  }

  return {
    systemInfo,
    loadClaudeInfo,
    clearClaudeInfo
  }
})
