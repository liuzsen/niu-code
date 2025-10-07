<template>
  <div class="flex flex-col flex-1 h-full min-h-0 max-w-[800px] w-[80%] mx-auto gap-4 p-4">
    <MessageList />
    <GlobalPermissionDialog v-if="chatManager.foregroundChat?.pendingRequest"
      :request="chatManager.foregroundChat?.pendingRequest" />
    <MessageInput v-else />
  </div>
</template>

<script setup lang="ts">
import MessageList from './MessageList.vue'
import MessageInput from './MessageInput.vue'
import GlobalPermissionDialog from './GlobalPermissionDialog.vue'
import { useChatManager } from '../stores/chat'

const chatManager = useChatManager()

</script>