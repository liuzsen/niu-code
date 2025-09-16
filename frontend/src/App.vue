<template>
  <div class="h-full flex flex-col" style="background-color: var(--surface-ground)">
    <AppHeader />

    <ChatLayout />
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
