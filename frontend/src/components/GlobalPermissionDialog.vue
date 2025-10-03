<template>
  <div
    class="animate-attention bg-surface-50 dark:bg-surface-900 rounded-2xl p-4 border border-surface-500 dark:border-surface-700 outline-none shadow-sm"
    tabindex="0" ref="permissionContainer" @keydown="handleKeyDown">
    <div class="flex flex-col gap-1">
      <div class="flex mb-2 items-center">
        <img src="@/assets/snowflake.svg" class="w-4 h-4 mr-2 animate-spin" alt="snowflake" />
        <div class="font-semibold">
          {{ questionText }}
        </div>
      </div>

      <!-- ExitPlanMode 专用选项 -->
      <template v-if="isExitPlanMode">
        <div class="permission-option" :class="{ 'permission-option-selected': selectedIndex === 0 }"
          @click="allowWithSuggestion" @mouseenter="selectedIndex = 0">
          <div class="flex items-center gap-2">
            <i class="pi pi-check text-green-500"></i>
            <span>Yes, and auto-accept edits</span>
          </div>
        </div>
        <div class="permission-option" :class="{ 'permission-option-selected': selectedIndex === 1 }"
          @click="allowPermission" @mouseenter="selectedIndex = 1">
          <div class="flex items-center gap-2">
            <i class="pi pi-check text-gray-500"></i>
            <span>Yes, and manually approve edits</span>
          </div>
        </div>
        <div class="permission-option" :class="{ 'permission-option-selected': selectedIndex === 2 }"
          @click="denyPermission" @mouseenter="selectedIndex = 2">
          <div class="flex items-center gap-2">
            <i class="pi pi-times text-red-500"></i>
            <span class="font-medium">No, keep planning (ESC)</span>
          </div>
        </div>
      </template>

      <!-- 通用工具权限选项 -->
      <template v-else>
        <div class="permission-option" :class="{ 'permission-option-selected': selectedIndex === 0 }"
          @click="allowPermission" @mouseenter="selectedIndex = 0">
          <div class="flex items-center gap-2">
            <i class="pi pi-check text-green-500"></i>
            <span>Yes</span>
          </div>
        </div>

        <div v-for="(suggestion, index) in suggestions" :key="index" class="permission-option"
          :class="{ 'permission-option-selected': selectedIndex === index + 1 }"
          @click="allowWithGenericSuggestion(suggestion)" @mouseenter="selectedIndex = index + 1">
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
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, watch, nextTick, useTemplateRef } from 'vue'
import type { PermissionUpdate } from '../types/message'
import type { PermissionResult } from '@anthropic-ai/claude-code'
import type { MessageManager } from '../services/messageManager'
import { useChatManager } from '../stores/chatManager'
import { useWorkspace } from '../stores/workspace'
import { useToast } from 'primevue'
import { extractFileName } from '../utils/pathProcess'

const chatManager = useChatManager()
const workspace = useWorkspace()
const messageManager = inject('messageManager') as MessageManager
const selectedIndex = ref(0)
const chatId = computed(() => chatManager.foregroundChat.chatId)
const permissionContainer = useTemplateRef("permissionContainer")

const request = computed(() => chatManager.foregroundChat.pendingRequest)

const isExitPlanMode = computed(() => request.value?.tool_use.tool_name === 'ExitPlanMode')

const suggestions = computed(() => request.value?.suggestions)

const questionText = computed(() => {
  if (!request.value) return ''

  if (isExitPlanMode.value) {
    return 'Would you like to proceed?'
  }

  const toolName = request.value.tool_use.tool_name

  if (toolName === 'Edit' || toolName === 'Write') {
    const file_path = request.value.tool_use.input.file_path
    const fileName = extractFileName(file_path)
    return `Do you want to make this edit to ${fileName}?`
  }

  if (toolName === 'Bash') {
    return `Do you want to run this command?`
  }

  return `Do you want to allow this ${toolName} operation?`
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
    messageManager.sendPermissionResponse(chatId.value, result)
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
  if (!request.value) return

  const result: PermissionResult = {
    behavior: 'deny',
    message: "",
    interrupt: true
  };

  sendPermissionResponse(result)
}

const allowPermission = () => {
  if (!request.value) return

  const result: PermissionResult = {
    behavior: 'allow',
    updatedInput: request.value.tool_use.input as Record<string, unknown>,
    updatedPermissions: []
  };

  sendPermissionResponse(result)
}

const allowWithSuggestion = () => {
  if (!request.value) return

  const result: PermissionResult = {
    behavior: 'allow',
    updatedInput: request.value.tool_use.input as Record<string, unknown>,
    updatedPermissions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }],
  };
  chatManager.foregroundChat.session.permissionMode = 'acceptEdits'
  sendPermissionResponse(result)
}

const allowWithGenericSuggestion = (suggestion: PermissionUpdate) => {
  if (!request.value) return

  const result: PermissionResult = {
    behavior: 'allow',
    updatedInput: request.value.tool_use.input as Record<string, unknown>,
    updatedPermissions: [suggestion]
  };
  sendPermissionResponse(result)
}

const totalOptions = computed(() => {
  if (isExitPlanMode.value) {
    return 3
  }
  return (suggestions.value?.length || 0) + 2
})

const handleKeyDown = (event: KeyboardEvent) => {
  if (!request.value) return

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
      executeSelectedOption()
      break
    case 'Escape':
      event.preventDefault()
      denyPermission()
      break
  }
}

const executeSelectedOption = () => {
  if (isExitPlanMode.value) {
    if (selectedIndex.value === 0) {
      allowWithSuggestion()
    } else if (selectedIndex.value === 1) {
      allowPermission()
    } else if (selectedIndex.value === 2) {
      denyPermission()
    }
  } else {
    if (selectedIndex.value === 0) {
      allowPermission()
    } else if (selectedIndex.value === (suggestions.value?.length || 0) + 1) {
      denyPermission()
    } else if (suggestions.value && selectedIndex.value <= suggestions.value.length) {
      allowWithGenericSuggestion(suggestions.value[selectedIndex.value - 1])
    }
  }
}

onMounted(() => {
  permissionContainer.value?.focus()
})

watch(() => request.value, (newRequest) => {
  if (newRequest) {
    selectedIndex.value = 0
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
