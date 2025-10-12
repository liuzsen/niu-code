<template>
  <div class="h-full flex flex-col text-body-text">
    <Toast />
    <router-view />
    <SessionListModal />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useGlobalToast } from './stores/toast'
import SessionListModal from './components/SessionListModal.vue'
import { Toast, useToast } from 'primevue'
import { provideWebSocket } from './composables/useWebSocket'
import { useMessageHandler } from './composables/useMessageHandler'
import { requestNotificationPermission } from './utils/notification'
import { useTheme } from './stores/theme'

const globalToast = useGlobalToast()
globalToast.setToast(useToast())

// 初始化主题系统
const themeStore = useTheme()
themeStore.initialize()

// 初始化 WebSocket（通过依赖注入）
provideWebSocket()

// 初始化消息处理器
useMessageHandler()

// 在应用启动时请求通知权限
onMounted(async () => {
  const permission = await requestNotificationPermission()
  console.log('通知权限状态:', permission)
})

</script>
