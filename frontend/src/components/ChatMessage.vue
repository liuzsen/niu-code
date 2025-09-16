<template>
  <div class="flex" :class="{ 'justify-end': message.role === 'user', 'justify-start': message.role === 'assistant' }">
    <div class="flex items-start space-x-2 max-w-3xl"
      :class="{ 'flex-row-reverse space-x-reverse': message.role === 'user' }">
      <div class="flex-shrink-0">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
          :class="message.role === 'user' ? 'bg-blue-500' : 'bg-emerald-500'">
          {{ message.role === 'user' ? 'U' : 'A' }}
        </div>
      </div>
      <div class="flex flex-col max-w-sm sm:max-w-md md:max-w-lg">
        <div class="rounded-2xl px-4 pt-2 pb-3 text-sm" :class="message.role === 'user'
          ? 'bg-blue-500 text-white rounded-br-lg'
          : 'bg-slate-100 text-slate-900 rounded-bl-lg'">
          <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
        </div>
        <p class="text-xs mt-1 text-slate-500 px-1" :class="{ 'text-right': message.role === 'user' }">
          {{ formatTime }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { Message } from '../types/message'

const props = defineProps<Props>()

interface Props {
  message: Message
}

const formatTime = computed(() => {
  return new Date(props.message.timestamp).toLocaleTimeString()
})
</script>