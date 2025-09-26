<template>
  <div
    class="animate-attention bg-surface-50 dark:bg-surface-900 rounded-sm p-2 border border-surface-500 dark:border-surface-700 outline-none mx-4 mb-3"
    tabindex="0" ref="permissionContainer" @keydown="handleKeyDown">
    <div class="flex flex-col gap-1">
      <div class="flex mb-2 items-center ">
        <img src="@/assets/snowflake.svg" class="w-4 h-4 mr-2 animate-spin" alt="snowflake" />
        <div>
          Would you like to proceed?
        </div>
      </div>
      <div class="permission-option" :class="{ 'permission-option-selected': selectedIndex === 0 }"
        @click="allowWithSuggestion" @mouseenter="selectedIndex = 0">
        <div class="flex items-center gap-2 ">
          <i class="pi pi-check text-green-500"></i>
          <span class="">Yes, and auto-accept edits</span>
        </div>
      </div>
      <div class="permission-option" :class="{ 'permission-option-selected': selectedIndex === 1 }"
        @click="allowPermission" @mouseenter="selectedIndex = 1">
        <div class="flex items-center gap-2 ">
          <i class="pi pi-check text-gray-500"></i>
          <span class="">Yes, and manualy approve edits</span>
        </div>
      </div>

      <div class="permission-option" :class="{ 'permission-option-selected': selectedIndex === 2 }"
        @click="denyPermission" @mouseenter="selectedIndex = 2">
        <div class="flex items-center gap-2">
          <i class="pi pi-times text-red-500"></i>
          <span class="font-medium">No, keep planning (ESC)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, watch, nextTick, useTemplateRef } from 'vue'
import type { PermissionResult } from '@anthropic-ai/claude-code'
import type { MessageManager } from '../services/messageManager'
import type { ToolPermissionRequest } from '../stores/chat'
import { useChatStore } from '../stores/chat'
import { useToast } from 'primevue'
import type { ToolUseState } from '../types'

const props = defineProps<{
  request: ToolPermissionRequest | null
}>()

const tool_use_state = defineModel<ToolUseState>({ required: true })

const chatStore = useChatStore()
const messageManager = inject('messageManager') as MessageManager
const selectedIndex = ref(0) // 当前选中状态（键盘和鼠标悬停都修改这个）
const chatId = chatStore.getCurrentChatId()
const permissionContainer = useTemplateRef("permissionContainer")

const toast = useToast()

const sendPermissionResponse = (result: PermissionResult) => {
  try {
    messageManager.sendPermissionResponse(chatId, result)
    chatStore.handlePermissionResult()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to send permission response:\n ${error}`,
    })
  }
}

const denyPermission = () => {
  if (!props.request) return
  tool_use_state.value = 'rejected'

  const result: PermissionResult = {
    behavior: 'deny',
    message: "",
    interrupt: true
  };

  sendPermissionResponse(result)
}

const allowPermission = () => {
  if (!props.request) return
  tool_use_state.value = 'ok'

  const result: PermissionResult = {
    behavior: 'allow',
    updatedInput: props.request.tool_use.input as Record<string, unknown>,
    updatedPermissions: []
  };

  sendPermissionResponse(result)
}

const allowWithSuggestion = () => {
  if (!props.request) return
  tool_use_state.value = 'ok'

  const result: PermissionResult = {
    behavior: 'allow',
    updatedInput: props.request.tool_use.input as Record<string, unknown>,
    updatedPermissions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }],
  };
  chatStore.currentSession.permissionMode = 'acceptEdits'
  sendPermissionResponse(result)
}

// 键盘导航处理 - 基于元素本身的键盘事件，只在组件有焦点时触发
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.request) return


  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = (selectedIndex.value + 2) % 3
      break
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = (selectedIndex.value + 1) % 3
      break
    case 'Enter':
      event.preventDefault()
      // 执行当前键盘选中的选项
      executeSelectedOption()
      break
    case 'Escape':
      event.preventDefault()
      denyPermission()
      break
  }
}

// 执行选中的选项
const executeSelectedOption = () => {
  if (selectedIndex.value === 0) {
    allowWithSuggestion()
  } else if (selectedIndex.value === 1) {
    allowPermission()
  } else if (selectedIndex.value === 2) {
    denyPermission()
  }
}

onMounted(() => {
  // 自动获取焦点，使键盘事件在组件级别处理
  permissionContainer.value?.focus()
})

// 监听request变化，有新的权限请求时重新聚焦
watch(() => props.request, (newRequest) => {
  if (newRequest) {
    nextTick(() => {
      permissionContainer.value?.focus()
    })
  }
}, { immediate: true })
</script>

<style scoped>
@reference "../style.css";

.permission-option {
  @apply cursor-pointer p-1 rounded-2xl border border-surface-400 transition-all duration-200;
}

.permission-option-selected {
  @apply bg-surface-300 dark:bg-orange-600;
}

/* Attention animation for permission requests - all-around shadow glow */
.animate-attention {
  animation: shadow-glow 2s ease-in-out infinite;
}

@keyframes shadow-glow {
  50% {
    box-shadow:
      0 0 8px 4px rgba(22, 134, 220, 0.2),
      0 0 20px 6px rgba(31, 148, 238, 0.15),
      0 0 36px 8px rgba(44, 154, 244, 0.1);
  }
}
</style>