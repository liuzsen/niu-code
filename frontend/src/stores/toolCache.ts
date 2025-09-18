import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources'
import { defineStore } from 'pinia'

export const useToolCacheStore = defineStore('toolCache', {
  state: () => ({
    results: new Map<string, ToolResultBlockParam>()
  }),

  actions: {
    setResult(id: string, result: ToolResultBlockParam) {
      this.results.set(id, result)
    },

    getResult(id: string): ToolResultBlockParam | undefined {
      return this.results.get(id)
    },

    clearResults() {
      this.results.clear()
    }
  },

  getters: {
    resultCount: (state) => state.results.size,
    isEmpty: (state) => state.results.size === 0,
    getAllResults: (state) => Array.from(state.results.values())
  }
})