<template>
  <div class="min-h-0">
    <!-- Modern Chat Input Container -->
    <div
      class="bg-surface-0 dark:bg-surface-800 border border-surface-400 dark:border-surface-500 rounded-2xl p-3 shadow-sm">
      <!-- Input Area -->
      <div class="mb-1">
        <Textarea v-model="messageInput" ref="textareaRef" placeholder="在这里输入消息，按 Enter 发送..."
          class="w-full resize-none border-0 bg-transparent !text-surface-300 min-h-8 max-h-32"
          :disabled="computedDisabled" :auto-resize="true" @keydown.enter.prevent="handleKeydown"
          :title="disabledTooltip" />
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between">
        <!-- Left Tool Buttons -->
        <div class="flex items-center gap-2">
          <Button icon="pi pi-paperclip" severity="secondary" variant="text" size="small"
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700" />
          <Button icon="pi pi-face-smile" severity="secondary" variant="text" size="small"
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700" />
          <Button icon="pi pi-at" severity="secondary" variant="text" size="small"
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700" />
          <Button icon="pi pi-image" severity="secondary" variant="text" size="small"
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700" />
          <Button icon="pi pi-bolt" severity="secondary" variant="text" size="small"
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700" />
          <Button icon="pi pi-th-large" severity="secondary" variant="text" size="small"
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700" />

          <!-- Language/Settings Button -->
          <Button icon="pi pi-language" severity="secondary" variant="text" size="small"
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700" />

          <!-- Export Button -->
          <Button icon="pi pi-download" severity="secondary" variant="text" size="small"
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700" @click="exportCurrentChat"
            :disabled="chatStore.messages.length === 0" title="导出对话" />
        </div>

        <!-- Right Side Buttons -->
        <div class="flex items-center gap-2">

          <!-- Send Button -->
          <Button @click="sendUserInput" :disabled="computedDisabled || !messageInput.trim()" icon="pi pi-arrow-up"
            severity="secondary" size="small" class="rounded-full w-8 h-8 p-0 shrink-0 dark:bg-surface-950"
            :title="disabledTooltip" />
        </div>
      </div>
    </div>


    <!-- Error Message -->
    <div v-if="error" class="mt-2 text-sm text-red-500">
      <i class="pi pi-exclamation-triangle mr-1"></i>
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, inject } from 'vue'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { useChatStore } from '../stores/chat'
import { useToast } from 'primevue/usetoast'
import type { MessageManager } from '../services/messageManager'
import { downloadChat } from '../utils/chatExporter'

interface Props {
  disabled?: boolean
  error?: string
}

const props = defineProps<Props>()

const messageInput = ref('')
const textareaRef = ref()

// 注入 messageManager
const messageManager = inject('messageManager') as MessageManager
const chatStore = useChatStore()
const toast = useToast()

// 从 store 获取输入状态
const storeDisabled = computed(() => chatStore.isInputDisabled)
const storeError = computed(() => chatStore.inputState.error)

// 组合的禁用状态
const computedDisabled = computed(() => props.disabled || storeDisabled.value)

// 禁用原因提示
const disabledTooltip = computed(() => {
  if (!storeDisabled.value) return ''

  switch (chatStore.inputDisableReason) {
    case 'tool_permission_pending':
      return '等待工具权限确认...'
    case 'processing':
      return '正在处理中...'
    case 'disconnected':
      return '连接已断开'
    case 'error':
      return storeError.value || '发生错误'
    default:
      return '输入已禁用'
  }
})

const sendUserInput = () => {
  if (!messageInput.value.trim()) return

  const chatId = chatStore.getCurrentChatId()
  messageManager.sendUserInput(chatId, messageInput.value.trim())
  messageInput.value = ''
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.shiftKey) {
    // Insert newline when Shift+Enter is pressed
    e.preventDefault()
    messageInput.value += '\n'
    console.log("new line")
  } else {
    // Send message when Enter is pressed without Shift
    sendUserInput()
  }
}

// 导出当前对话
function exportCurrentChat() {
  if (chatStore.messages.length === 0) {
    toast.add({
      severity: 'warn',
      summary: '提示',
      detail: '当前没有可导出的对话',
      life: 3000
    })
    return
  }

  try {
    downloadChat(chatStore)

    toast.add({
      severity: 'success',
      summary: '导出成功',
      detail: '对话已成功导出',
      life: 3000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '导出失败',
      detail: `导出对话时发生错误: ${error}`,
      life: 5000
    })
  }
}

// Auto-scroll to bottom when content changes
watch(messageInput, async () => {
  await nextTick()
  if (textareaRef.value?.$el) {
    const textarea = textareaRef.value.$el
    textarea.scrollTop = textarea.scrollHeight
  }
})
</script>