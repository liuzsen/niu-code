<template>
  <div
    class=" bg-surface-100 dark:bg-surface-800 flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar-light rounded-xl border-x border-y border-surface-300 dark:border-surface-700"
    ref="messagesContainer">

    <div v-if="chatManager.foregroundChat.messages.length === 0" class="text-center mt-12">
      <i class="pi pi-comments text-4xl mb-4 block"></i>
      <p>Welcome to Claude Code Web</p>
      <p class="text-sm mt-2">Connect to start chatting with Claude</p>
    </div>

    <template v-else>
      <ChatMessage v-for="(message, index) in displayMessagesWithId"
        :key="`${chatManager.foregroundChat.chatId}-${index}`" :message="message" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import ChatMessage from './ChatMessage.vue'
import { useChatManager } from '../stores/chatManager'

// 使用统一的聊天 store
const chatManager = useChatManager()
const displayMessages = computed(() => chatManager.foregroundChat.messages)

// 将 ChatMessageData 转换为 ChatMessage 格式
const displayMessagesWithId = computed(() => {
  return displayMessages.value?.map(messageData => ({
    chat_id: chatManager.foregroundChat.chatId,
    data: messageData
  }))
})

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
