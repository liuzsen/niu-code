<template>
  <div class="h-full flex flex-col">
    <Toast />
    <AppHeader />
    <div class=" overflow-hidden bg-surface-200 dark:bg-surface-900 h-full">
      <ChatLayout />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ChatLayout from './components/ChatLayout.vue'
import Toast from 'primevue/toast'
import { wsService } from './services/websocket'

onUnmounted(() => {
  wsService.disconnect()
})
</script>
