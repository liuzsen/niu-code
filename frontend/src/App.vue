<template>
  <Toast />
  <router-view />
  <SessionListModal />
</template>

<script setup lang="ts">
import { useGlobalToast } from './stores/toast'
import SessionListModal from './components/SessionListModal.vue'
import { Toast, useToast } from 'primevue'
import { provideWebSocket } from './composables/useWebSocket'
import { useMessageHandler } from './composables/useMessageHandler'

const globalToast = useGlobalToast()
globalToast.setToast(useToast())

// 初始化 WebSocket（通过依赖注入）
provideWebSocket()

// 初始化消息处理器
useMessageHandler()

</script>
