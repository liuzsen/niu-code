<template>
  <div class="flex flex-col flex-1 h-full min-h-0 max-w-[800px] w-[80%] mx-auto gap-4 p-4">
    <MessageList />
    <MessageInput :disabled="!isConnected" :error="error || undefined" />
  </div>
</template>

<script setup lang="ts">
import MessageList from './MessageList.vue'
import MessageInput from './MessageInput.vue'
import { useConnection } from '../composables/useConnection'

const { isConnected, error } = useConnection()

</script>