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
import { useMessageProcessing } from './composables/useMessageProcessing'

// 初始化消息处理系统（只负责分类，不返回数据）
useMessageProcessing()

onUnmounted(() => {
  wsService.disconnect()
})
</script>
