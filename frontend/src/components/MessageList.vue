<template>
  <div class="flex-1 border border-surface-300 overflow-y-auto p-4 space-y-4" ref="messagesContainer">
    <ChatMessage v-for="message in messages" :key="message.timestamp" :message="message" />

    <div v-if="messages.length === 0" class="text-center mt-12" style="color: var(--text-color-secondary)">
      <i class="pi pi-comments text-4xl mb-4 block"></i>
      <p>Welcome to Claude Code Web</p>
      <p class="text-sm mt-2">Connect to start chatting with Claude</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import ChatMessage from './ChatMessage.vue'
import { wsService } from '../services/websocket'

const messages = wsService.messages

const messagesContainer = ref<HTMLElement>()

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(messages, scrollToBottom, { deep: true })
</script>