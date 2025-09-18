import { defineStore } from 'pinia'
import type { ChatMessage } from '../types/chat'

export const useRenderableMessagesStore = defineStore('renderableMessages', {
  state: () => ({
    messages: [] as ChatMessage[]
  }),

  actions: {
    addMessage(message: ChatMessage) {
      this.messages.push(message)
    },

    clearMessages() {
      this.messages = []
    }
  },

  getters: {
    messageCount: (state) => state.messages.length,
    isEmpty: (state) => state.messages.length === 0
  }
})