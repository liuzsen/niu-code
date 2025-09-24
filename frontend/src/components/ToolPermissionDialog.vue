<template>
  <Dialog v-model:visible="visible" modal :closable="false" class="w-[40%]" @show="onDialogShow" @hide="onDialogHide">
    <template #header>
      <div class="flex items-center">
        <i class="pi pi-shield text-2xl text-surface-500 mr-3"></i>
        <div class=" text-surface-600">
          Claude 请求使用工具
        </div>
        <Button v-if="isDev" icon="pi pi-download" severity="secondary" variant="text" size="small"
          class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700"
          @click="exportCurrentChat(toast)" title="导出对话" />
      </div>
    </template>

    <div>
      <div v-if="writeInput">
        <WriteInput :content="writeInput.content" :file_path="writeInput.file_path"></WriteInput>
      </div>
      <div v-else-if="editInput">
        <EditInput :input="editInput"></EditInput>
      </div>
      <div v-else class="border border-surface-300 dark:border-surface-600 rounded-lg p-4 overflow-auto">
        <pre>{{ JSON.stringify(request, null, 2) }} </pre>
      </div>
    </div>
    <div>
      <div class="flex flex-col gap-2 mt-4">
        <div class="permission-option" :class="{ 'permission-option-selected': selectedIndex === 0 }"
          @click="allowPermission" @mouseenter="selectedIndex = 0">
          <div class="flex items-center gap-2">
            <i class="pi pi-check text-success-500"></i>
            <span class="">Allow</span>
          </div>
        </div>

        <div v-for="(suggestion, index) in suggestions" :key="index" class="permission-option"
          :class="{ 'permission-option-selected': selectedIndex === index + 1 }"
          @click="allowWithSuggestion(suggestion)" @mouseenter="selectedIndex = index + 1">
          <div class="flex items-center gap-2">
            <i class="pi pi-lightbulb text-primary-500"></i>
            <span class="font-medium">{{ suggestionText(suggestion) }}</span>
          </div>
        </div>

        <div class="permission-option"
          :class="{ 'permission-option-selected': selectedIndex === (suggestions?.length || 0) + 1 }"
          @click="denyPermission" @mouseenter="selectedIndex = (suggestions?.length || 0) + 1">
          <div class="flex items-center gap-2">
            <i class="pi pi-times text-danger-500"></i>
            <span class="font-medium">No, and tell Claude what to do differently (ESC)</span>
          </div>
        </div>
      </div>
    </div>
  </Dialog>


</template>

<script setup lang="ts">
import { computed, inject, ref, onUnmounted } from 'vue'
import Dialog from 'primevue/dialog'
import { useChatStore } from '../stores/chat'
import type { PermissionUpdate } from '../types/message'
import type { MessageManager } from '../services/messageManager'
import type { PermissionResult } from '@anthropic-ai/claude-code'
import { Button, useToast } from 'primevue'
import { exportCurrentChat } from '../utils/chatExporter'
import WriteInput from './permission-renders/WriteInput.vue'
import EditInput from './permission-renders/EditInput.vue'


const isDev = import.meta.env.DEV

const toast = useToast()
const chatStore = useChatStore()
const chatId = chatStore.getCurrentChatId()
const messageManager = inject('messageManager') as MessageManager

const selectedIndex = ref(0)

// 计算总选项数量
const totalOptions = computed(() => {
  return (suggestions.value?.length || 0) + 2 // Allow + Deny + Suggestions
})

const visible = computed({
  get: () => chatStore.pendingPermissionRequest !== null,
  set: (val) => !val && denyPermission()
})

const request = computed(() => chatStore.pendingPermissionRequest)
const suggestions = computed(() => request.value?.suggestions)

const writeInput = computed(() => {
  if (request.value?.tool_use.tool_name == 'Write') {
    return request.value.tool_use.input
  }
  return undefined
})

const editInput = computed(() => {
  if (request.value?.tool_use.tool_name == 'Edit') {
    return request.value.tool_use.input
  }

  return undefined
})

function suggestionText(suggestion: PermissionUpdate) {
  switch (suggestion.type) {
    case 'setMode':
      if (suggestion.mode == 'acceptEdits') {
        if (suggestion.destination == 'session') {
          return 'Yes, allow all edits during this session'
        } else if (suggestion.destination == 'projectSettings') {
          return 'Yes, allow all edits in this project'
        }
      }
      break
    default:
      return suggestion
  }

  return `Unknown suggestion type: ${suggestion}`
}

// 拒绝权限
const denyPermission = () => {
  if (!request.value) return

  const result: PermissionResult = {
    behavior: 'deny',
    message: "",
    interrupt: true
  };

  messageManager.sendPermissionResponse(chatId, result)
  chatStore.handlePermissionResult()
}

// 允许权限
const allowPermission = () => {
  if (!request.value) return

  const result: PermissionResult = {
    behavior: 'allow',
    updatedInput: request.value.tool_use.input as Record<string, unknown>,
    updatedPermissions: []
  };
  messageManager.sendPermissionResponse(chatId, result)
  chatStore.handlePermissionResult()
}

// 允许权限并记住选择（应用建议）
const allowWithSuggestion = (suggestion: PermissionUpdate) => {
  if (!request.value) return

  const result: PermissionResult = {
    behavior: 'allow',
    updatedInput: request.value.tool_use.input as Record<string, unknown>,
    updatedPermissions: [suggestion]
  };
  messageManager.sendPermissionResponse(chatId, result)
  chatStore.handlePermissionResult()
}

// 键盘导航处理
const handleKeyDown = (event: KeyboardEvent) => {
  // 如果对话框不可见，不处理键盘事件
  if (!visible.value) return

  const maxIndex = totalOptions.value - 1

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      event.stopPropagation()
      selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : maxIndex
      break
    case 'ArrowDown':
      event.preventDefault()
      event.stopPropagation()
      selectedIndex.value = selectedIndex.value < maxIndex ? selectedIndex.value + 1 : 0
      break
    case 'Enter':
      event.preventDefault()
      event.stopPropagation()
      executeSelectedOption()
      break
  }
}

// 执行选中的选项
const executeSelectedOption = () => {
  if (selectedIndex.value === 0) {
    allowPermission()
  } else if (selectedIndex.value === (suggestions.value?.length || 0) + 1) {
    denyPermission()
  } else if (suggestions.value && selectedIndex.value <= suggestions.value.length) {
    allowWithSuggestion(suggestions.value[selectedIndex.value - 1])
  }
}

// 对话框显示时处理
const onDialogShow = () => {
  // 对话框显示时添加全局键盘事件监听
  document.addEventListener('keydown', handleKeyDown)
}

// 对话框隐藏时处理
const onDialogHide = () => {
  // 对话框隐藏时移除全局键盘事件监听
  document.removeEventListener('keydown', handleKeyDown)
}

// 组件卸载时移除事件监听
onUnmounted(() => {
  console.log("unmounted")
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
@reference "../style.css";

.permission-option {
  @apply cursor-pointer p-2 rounded-lg border border-surface-300 transition-all duration-200;
}

.permission-option-selected {
  @apply bg-surface-300 dark:bg-orange-300;
}
</style>
