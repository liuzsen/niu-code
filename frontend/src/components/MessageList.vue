<template>
  <div
    class=" bg-surface-200 dark:bg-surface-900 flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar rounded-xl border-x border-y border-surface-300 dark:border-surface-700"
    ref="messagesContainer">
    <ChatMessage v-for="message in displayMessages" :key="message.timestamp" :message="message" />

    <div v-if="displayMessages.length === 0" class="text-center mt-12" style="color: var(--text-color-secondary)">
      <i class="pi pi-comments text-4xl mb-4 block"></i>
      <p>Welcome to Claude Code Web</p>
      <p class="text-sm mt-2">Connect to start chatting with Claude</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import ChatMessage from './ChatMessage.vue'
import { useChatStore } from '../stores/chat'

// 使用统一的聊天 store
const chatStore = useChatStore()
const displayMessages = computed(() => chatStore.standaloneMessages)

const messagesContainer = ref<HTMLElement>()

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(displayMessages, scrollToBottom, { deep: true })
</script>

<style scoped>
.custom-scrollbar {
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: #888 transparent;
}

/* WebKit */
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>