import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { recentProjectsStore } from '../services/recentProjects'

export const useWorkspace = defineStore('workspace', () => {
  const cwd = ref<string | null>(null)

  const workingDirectory = computed(() => cwd.value)
  const hasWorkingDirectory = computed(() => !!cwd.value)

  const setCwd = (path: string) => {
    cwd.value = path
    // Add to recent projects
    recentProjectsStore.add(path)
  }

  const clearCwd = () => {
    cwd.value = null
  }

  return {
    cwd,
    workingDirectory,
    hasWorkingDirectory,
    setCwd,
    clearCwd
  }
})
