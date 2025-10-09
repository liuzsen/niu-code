<template>
  <div class="flex flex-col flex-1 h-full min-h-0 max-w-[800px] w-[80%] mx-auto gap-0 p-4">
    <MessageList />
    <!-- Working status indicator - Fixed at bottom -->
    <div v-if="isGenerating" class="pl-4 py-0.5 flex justify-start gap-3 rounded-b-xl">
      <img src="../assets/ikun.gif" alt="working" class="h-5 w-5" />
      <span class="text-sm font-medium text-surface-600 dark:text-surface-400">{{ workingStatus }}</span>
    </div>
    <div class="" :class="{ 'mt-0': isGenerating, 'mt-4': !isGenerating }">
      <GlobalPermissionDialog v-if="chatManager.foregroundChat?.pendingRequest"
        :request="chatManager.foregroundChat?.pendingRequest" />
      <MessageInput v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MessageList from './MessageList.vue'
import MessageInput from './MessageInput.vue'
import GlobalPermissionDialog from './GlobalPermissionDialog.vue'
import { useChatManager } from '../stores/chat'

const chatManager = useChatManager()

// 检查是否正在生成
const isGenerating = computed(() => {
  return chatManager.foregroundChat?.isGenerating
})

// 计算工作状态显示文本
const workingStatus = computed(() => {
  const todoList = chatManager.foregroundChat?.todoList
  if (!todoList) {
    return 'working...'
  }

  // 计算进度信息
  const completedCount = todoList.todos.filter(item => item.status === 'completed').length
  const totalCount = todoList.todos.length
  const progress = `(${completedCount}/${totalCount})`

  // 查找 in_progress 状态的 todo item
  const inProgressItem = todoList.todos.find(item => item.status === 'in_progress')
  if (inProgressItem) {
    return `${inProgressItem.activeForm}  ${progress}`
  }

  return `working...`
})

</script>