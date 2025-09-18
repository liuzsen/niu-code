<template>
  <div class="flex w-full"
    :class="{ 'justify-end': message.from === 'user', 'justify-start': message.from === 'agent' }">
    <div class="flex items-start w-full space-x-2 max-w-3xl"
      :class="{ 'flex-row-reverse space-x-reverse': message.from === 'user' }">
      <div class="flex-shrink-0">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
          :class="message.from === 'user' ? 'bg-blue-500' : 'bg-emerald-500'">
          {{ message.from === 'user' ? 'U' : 'A' }}
        </div>
      </div>
      <div class="flex flex-col flex-1">
        <div class="rounded-2xl px-4 pt-2 pb-2 text-sm" :class="message.from === 'user'
          ? 'bg-blue-500 text-white rounded-br-lg'
          : 'bg-slate-100 text-slate-900 rounded-bl-lg'">
          <!-- 用户消息 -->
          <div v-if="isUserMessage(message)" class="whitespace-pre-wrap break-words">
            {{ message.content }}
          </div>
          <!-- Agent 消息-->
          <div v-else-if="rendererInfo">
            <component :is="rendererInfo.component" :message="rendererInfo.props.message"
              :data="rendererInfo.props.data" :key="message.id" />
          </div>
        </div>

        <p class="text-xs mt-1 text-slate-500 px-1" :class="{ 'text-right': message.from === 'user' }">
          {{ formatTime }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { ChatMessage } from '../types/chat'
import { isUserMessage } from '../types/chat'
import type { Component } from 'vue'

interface Props {
  message: ChatMessage
  rendererInfo?: {
    component: Component
    props: {
      message: any
      data: any
    }
  } | null
}

const props = defineProps<Props>()

// 格式化时间
const formatTime = computed(() => {
  return new Date(props.message.timestamp).toLocaleTimeString()
})
</script>
