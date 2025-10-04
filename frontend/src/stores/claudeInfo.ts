import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ClaudeSystemInfo } from '../types/message'
import { apiService } from '../services/api'

export const useClaudeInfo = defineStore('claude-info', () => {
  const systemInfo = ref<ClaudeSystemInfo | null>(null)

  const loadClaudeInfo = async (workDir: string) => {
    try {
      const info = await apiService.getClaudeInfo(workDir)
      systemInfo.value = info
      return info
    } catch (error) {
      console.error('Failed to load Claude info:', error)
      throw error
    }
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
