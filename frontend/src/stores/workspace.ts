import { defineStore } from 'pinia'

export const useWorkspace = defineStore('workspace', {
  state: () => ({
    cwd: '/data/home/sen/code/projects/ai/zsen-cc-web'
  }),

  getters: {
    workingDirectory: (state) => state.cwd,
    hasWorkingDirectory: (state) => !!state.cwd
  },

  actions: {
    setCwd(path: string) {
      this.cwd = path
    }
  }
})
