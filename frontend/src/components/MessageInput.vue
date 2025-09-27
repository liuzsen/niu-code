<template>
  <div class="min-h-0">
    <div class="bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-500 rounded-2xl p-3 shadow-sm">
      <!-- Input Area -->
      <div class="mb-1">
        <div ref="editorRef" class="w-full resize-none border-0 bg-transparent min-h-20 px-2
          text-zinc-800 leading-6 custom-tiptap-editor" :title="disabledTooltip">
          <EditorContent :editor="editor" />
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between">
        <!-- Left Tool Buttons -->
        <div class="flex items-center gap-2">
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
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700"
            @click="exportCurrentChat(toast)" :disabled="chatStore.messages.length === 0" title="导出对话" />
        </div>

        <!-- Right Side Buttons -->
        <div class="flex items-center gap-2">
          <Select v-model="chatStore.currentSession.permissionMode" :options="permissionModeOptions" optionLabel="label"
            optionValue="value" @change="onPermissionModeChange" class="h-7 text-sm permission-select"
            :label-class="'px-2 pt-1 pb-0.5'" variant="filled" size="small"
            :pt="{ dropdownIcon: { class: ' bg-red' } }">
          </Select>

          <!-- Send Button -->
          <Button @click="sendUserInput" :disabled="computedDisabled || !editorContent.trim()" icon="pi pi-arrow-up"
            severity="secondary" size="small"
            class="rounded-full w-10 h-10 p-0 shrink-0 dark:bg-surface-950 dark:text-surface-300 bg-surface-300 text-surface-700"
            v-tooltip.top="{ value: 'shift + ctrl + enter', pt: { text: 'bg-surface-300 dark:bg-surface-950 text-xs' } }"
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
import { ref, watch, computed, inject, onMounted, onBeforeUnmount } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { useChatStore } from '../stores/chat'
import type { MessageManager } from '../services/messageManager'
import type { ClientMessage } from '../types/message'
import { exportCurrentChat } from '../utils/chatExporter'
import { useToast } from 'primevue'
import { wsService } from '../services/websocket'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { htmlToMarkdown } from '../utils/contentConverter'

const toast = useToast()

interface Props {
  disabled?: boolean
  error?: string
}

const props = defineProps<Props>()

const editorContent = ref('')
const editorRef = ref<HTMLElement>()

const permissionModeOptions = [
  { label: 'default', value: 'default' },
  { label: 'plan', value: 'plan' },
  { label: 'acceptEdits', value: 'acceptEdits' },
  { label: 'bypassPermissions', value: 'bypassPermissions' },
]

// 注入 messageManager
const messageManager = inject('messageManager') as MessageManager
const chatStore = useChatStore()

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
  if (!editor.value || editor.value.isEmpty) return

  const htmlContent = editor.value.getHTML()
  const textContent = editor.value.getText()

  if (!textContent.trim()) return

  const chatId = chatStore.getCurrentChatId()

  // 将 HTML 转换为 Markdown
  const markdownContent = htmlToMarkdown(htmlContent)

  console.log(markdownContent)

  messageManager.sendUserInput(chatId, markdownContent)
  editor.value.commands.clearContent();
}


// 初始化 TipTap 编辑器
const editor = useEditor({
  content: '',
  extensions: [
    StarterKit
  ],
  editable: !computedDisabled.value,
  autofocus: true,
})

// 监听禁用状态变化
watch(computedDisabled, (disabled) => {
  if (editor.value) {
    editor.value.setEditable(!disabled)
  }
})

// 键盘事件监听
const handleKeyDown = (event: KeyboardEvent) => {
  // 检测 Ctrl+Shift+Enter
  if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
    console.log("send msg")
    event.preventDefault()
    sendUserInput()
  }
}

// 在组件挂载时添加键盘事件监听
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

// 组件卸载时清理
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown)
  if (editor.value) {
    editor.value.destroy()
  }
})

// 权限模式变更处理
const onPermissionModeChange = () => {
  // 发送模式更新消息到服务器
  const chatId = chatStore.getCurrentChatId()
  const message: ClientMessage = {
    chat_id: chatId,
    data: {
      kind: 'set_mode',
      mode: chatStore.currentSession.permissionMode
    }
  }

  wsService.sendMessage(message)
}

import '../assets/tiptap.css'
</script>

<style scoped>
.permission-select :deep(.p-select-dropdown) {
  display: none;
}
</style>
