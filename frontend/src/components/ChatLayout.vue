<template>
  <div class="flex flex-col flex-1 h-full min-h-0 max-w-[800px] w-[80%] mx-auto gap-4 p-4">
    <MessageList />
    <GlobalPermissionDialog v-if="hasPendingRequest" />
    <MessageInput v-else :disabled="!isConnected" :error="error || undefined" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MessageList from './MessageList.vue'
import MessageInput from './MessageInput.vue'
import GlobalPermissionDialog from './GlobalPermissionDialog.vue'
import { useConnection } from '../composables/useConnection'
import { useChatManager } from '../stores/chatManager'

const { isConnected, error } = useConnection()
const chatManager = useChatManager()

const hasPendingRequest = computed(() => !!chatManager.foregroundChat?.pendingRequest)

</script>