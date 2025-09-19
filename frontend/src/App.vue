<template>
  <div class="h-full flex flex-col">
    <AppHeader />
    <div class=" overflow-hidden bg-surface-200 dark:bg-surface-900">
      <ChatLayout />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ChatLayout from './components/ChatLayout.vue'
import { wsService } from './services/websocket'

onUnmounted(() => {
  wsService.disconnect()
})
</script>
