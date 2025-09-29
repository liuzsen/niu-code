<template>
  <div
    class="animate-attention bg-surface-50 dark:bg-surface-900 rounded-sm p-2 border border-surface-500 dark:border-surface-700 outline-none mx-4 mb-3"
    tabindex="0" ref="permissionContainer" @keydown="handleKeyDown">
    <div class="flex flex-col gap-1">
      <div class="flex mb-2 items-center ">
        <img src="@/assets/snowflake.svg" class="w-4 h-4 mr-2 animate-spin" alt="snowflake" />
        <slot name="question"></slot>
      </div>
      <div class="permission-option" :class="{ 'permission-option-selected': selectedIndex === 0 }"
        @click="allowPermission" @mouseenter="selectedIndex = 0">
        <div class="flex items-center gap-2 ">
          <i class="pi pi-check text-green-500"></i>
          <span class="">Yes</span>
        </div>
      </div>

      <div v-for="(suggestion, index) in suggestions" :key="index" class="permission-option"
        :class="{ 'permission-option-selected': selectedIndex === index + 1 }" @click="allowWithSuggestion(suggestion)"
        @mouseenter="selectedIndex = index + 1">
        <div class="flex items-center gap-2">
          <i class="pi pi-lightbulb text-orange-500"></i>
          <span class="font-medium" v-html="suggestionText(suggestion)"></span>
        </div>
      </div>

      <div class="permission-option"
        :class="{ 'permission-option-selected': selectedIndex === (suggestions?.length || 0) + 1 }"
        @click="denyPermission" @mouseenter="selectedIndex = (suggestions?.length || 0) + 1">
        <div class="flex items-center gap-2">
          <i class="pi pi-times text-red-500"></i>
          <span class="font-medium">No, and tell Claude what to do differently (ESC)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, watch, nextTick, useTemplateRef } from 'vue'
import type { PermissionUpdate } from '../types/message'
import type { PermissionResult } from '@anthropic-ai/claude-code'
import type { MessageManager } from '../services/messageManager'
import type { ToolPermissionRequest } from '../types/message'
import { useChatManager } from '../stores/chatManager'
import { useWorkspace } from '../stores/workspace'
import { useToast } from 'primevue'
import type { ToolUseState } from '../types'

const props = defineProps<{
  request: ToolPermissionRequest | null
}>()
const emit = defineEmits<{
  (e: "confirmed", choise: "allow" | "deny"): void
}>()

const tool_use_state = defineModel<ToolUseState>({ required: true })

const chatManager = useChatManager()
const workspace = useWorkspace()
const messageManager = inject('messageManager') as MessageManager
const selectedIndex = ref(0) // 当前选中状态（键盘和鼠标悬停都修改这个）
const chatId = chatManager.foregroundChat.chatId
const permissionContainer = useTemplateRef("permissionContainer")

const suggestions = computed(() => props.request?.suggestions)

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
    case "addRules": {
      const rule = suggestion.rules[0];
      if (rule.toolName == "Bash") {
        if (suggestion.destination == 'localSettings') {
          const cmd = rule.ruleContent?.replace(":*", "");
          const cmd_html = `<span class="text-orange-500 font-bold">${cmd}</span>`
          return `Yes and don't ask again for commands ${cmd_html} in ${workspace.workingDirectory}`
        }
      }
      break
    }
    default:
      return suggestion
  }

  return `Unknown suggestion type: ${suggestion}`
}

const toast = useToast()

const sendPermissionResponse = (result: PermissionResult) => {
  try {
    messageManager.sendPermissionResponse(chatId, result)
    // 清除 pending request
    chatManager.foregroundChat.pendingRequest = undefined
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
  emit('confirmed', 'deny')

  const result: PermissionResult = {
    behavior: 'deny',
    message: "",
    interrupt: true
  };

  sendPermissionResponse(result)
}

const allowPermission = () => {
  if (!props.request) return
  emit('confirmed', 'allow')

  const result: PermissionResult = {
    behavior: 'allow',
    updatedInput: props.request.tool_use.input as Record<string, unknown>,
    updatedPermissions: []
  };

  sendPermissionResponse(result)
}

const allowWithSuggestion = (suggestion: PermissionUpdate) => {
  if (!props.request) return
  emit('confirmed', 'allow')

  const result: PermissionResult = {
    behavior: 'allow',
    updatedInput: props.request.tool_use.input as Record<string, unknown>,
    updatedPermissions: [suggestion]
  };
  sendPermissionResponse(result)
}

// 计算总选项数量
const totalOptions = computed(() => {
  return (suggestions.value?.length || 0) + 2 // Allow + Deny + Suggestions
})

// 键盘导航处理 - 基于元素本身的键盘事件，只在组件有焦点时触发
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.request) return

  const maxIndex = totalOptions.value - 1

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : maxIndex
      break
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = selectedIndex.value < maxIndex ? selectedIndex.value + 1 : 0
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
    allowPermission()
  } else if (selectedIndex.value === (suggestions.value?.length || 0) + 1) {
    denyPermission()
  } else if (suggestions.value && selectedIndex.value <= suggestions.value.length) {
    allowWithSuggestion(suggestions.value[selectedIndex.value - 1])
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
  animation: shadow-glow 3s ease-in-out infinite;
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