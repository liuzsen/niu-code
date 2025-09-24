<template>
  <div class="flex flex-col flex-1 h-full min-h-0 max-w-[800px] w-[80%] mx-auto gap-4 p-4">
    <MessageList />
    <MessageInput :disabled="!isConnected" :error="error || undefined" />

    <!-- 权限确认对话框 -->
    <ToolPermissionDialog v-if="request" />
  </div>
</template>

<script setup lang="ts">
import MessageList from './MessageList.vue'
import MessageInput from './MessageInput.vue'
import ToolPermissionDialog from './ToolPermissionDialog.vue'
import { useConnection } from '../composables/useConnection'
import { useChatStore } from '../stores/chat'
import { computed } from 'vue'

const { isConnected, error } = useConnection()
const chatStore = useChatStore()

const request = computed(() => chatStore.pendingPermissionRequest)
</script>