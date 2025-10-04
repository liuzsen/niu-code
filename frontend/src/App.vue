<template>
  <Toast />
  <router-view />
  <SessionListModal />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useGlobalToast } from './stores/toast';
import SessionListModal from './components/SessionListModal.vue'
import { Toast, useToast } from 'primevue';
import { messageManager } from './services/messageManager'

const globalToast = useGlobalToast()
globalToast.setToast(useToast())

// 初始化 WebSocket 连接
onMounted(async () => {
  try {
    await messageManager.ws.connect()
    console.log('WebSocket connected on app mount')
  } catch (error) {
    console.error('Failed to connect WebSocket on app mount:', error)
  }
})

</script>
