<template>
  <div class="min-h-0">
    <!-- Prompt History Modal -->
    <PromptHistoryList :visible="messageEditor.promptHistoryModal.isVisible.value"
      :allPrompts="messageEditor.promptHistoryModal.cachedPrompts.value"
      :fuseInstance="messageEditor.promptHistoryModal.fuseInstance.value"
      :onSelect="messageEditor.promptHistoryModal.selectPrompt" :onClose="messageEditor.promptHistoryModal.hide" />

    <div class="bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-500 rounded-2xl p-3 shadow-sm">
      <!-- Input Area -->
      <div class="mb-1">
        <!-- 图片缩略图 -->
        <ImageThumbnails
          :images="messageEditor.attachedImages.value"
          @remove="messageEditor.removeImage"
        />

        <div class="w-full resize-none border-0 bg-transparent min-h-20 px-2 focus:outline-2
          text-zinc-800 dark:text-slate-200 custom-tiptap-editor">
          <EditorContent :editor="messageEditor.editor.value" />
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

          <!-- 图片上传按钮 -->
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            class="hidden"
            @change="handleFileSelect"
          />
          <Button
            icon="pi pi-image"
            severity="secondary"
            variant="text"
            size="small"
            class="p-1 w-7 h-7 text-surface-500 dark:text-surface-400 hover:text-surface-700"
            @click="triggerFileInput"
            title="上传图片"
          />

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
            @click="exportCurrentChat()" :disabled="foregroundChat?.messages.length === 0" title="导出对话" />
        </div>

        <!-- Right Side Buttons -->
        <div class="flex items-center gap-2">
          <!-- Config Name Selector -->
          <MessageEditorConfig :chat="foregroundChat" :disabled="foregroundChat?.started()" />

          <!-- Permission Mode Selector -->
          <MessagePermissionMode v-model="permissionMode" @change="onPermissionModeChange" />

          <!-- Send Button -->
          <Button v-if="!isGenerating" @click="messageEditor.handleSend" :disabled="!messageEditor.editable.value"
            icon="pi pi-arrow-up" severity="secondary" size="small"
            class="rounded-full w-10 h-10 p-0 shrink-0 transition-all duration-200 dark:bg-surface-950 dark:text-surface-300 bg-surface-300 text-surface-700"
            v-tooltip.top="{ value: 'Enter', pt: { text: 'bg-surface-300 dark:bg-surface-950 text-xs' } }"
            :title="messageEditor.disabledTooltip.value || '发送消息 (Enter)'" />

          <!-- Interrupt Button -->
          <Button v-else @click="handleStopGeneration" :disabled="!messageEditor.editable.value" icon="pi pi-stop"
            severity="secondary" size="small"
            class="rounded-full w-10 h-10 p-0 shrink-0 transition-all duration-200 bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700"
            v-tooltip.top="{ value: 'Ctrl + C', pt: { text: 'red dark:bg-surface-950 text-xs' } }"
            title="停止生成 (interrupt)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import { useChatStore } from '../../stores/chat'
import { useMessageSender } from '../../composables/useMessageSender'
import { useFileWatch } from '../../composables/useFileWatch'
import { useMessageEditor } from '../../composables/useMessageEditor'
import { exportCurrentChat } from '../../utils/chatExporter'
import { EditorContent } from '@tiptap/vue-3'
import PromptHistoryList from '../prompt-history/PromptHistoryList.vue'
import MessageEditorConfig from './SelectClaudeConfig.vue'
import MessagePermissionMode from './SelectPermissionMode.vue'
import ImageThumbnails from './ImageThumbnails.vue'
import type { PermissionMode } from '@anthropic-ai/claude-code'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources'

// Stores and composables
const chatStore = useChatStore()
const sender = useMessageSender()

// 初始化文件监听
useFileWatch()

const foregroundChat = computed(() => chatStore.foregroundChat)

// 按钮状态计算属性
const isGenerating = computed(() => foregroundChat.value?.isGenerating || false)

// 停止生成
const handleStopGeneration = () => {
  const chatId = foregroundChat.value?.chatId || ''
  if (chatId) {
    sender.sendInterrupt(chatId)
  }
}

// 发送消息回调
const handleSendMessage = (content: string | Array<ContentBlockParam>) => {
  const chatId = foregroundChat.value?.chatId || ''
  sender.sendUserInput(chatId, content)
}

// 初始化消息编辑器
const messageEditor = useMessageEditor({
  isGenerating,
  onStopGeneration: handleStopGeneration,
  onSendMessage: handleSendMessage,
})

// 权限模式双向绑定
const permissionMode = computed({
  get: () => foregroundChat.value?.session.permissionMode || 'default',
  set: (value: PermissionMode) => {
    if (foregroundChat.value?.session) {
      foregroundChat.value.session.permissionMode = value
    }
  }
})

// 权限模式变更处理
const onPermissionModeChange = async () => {
  const chatId = foregroundChat.value?.chatId || ''
  const mode = foregroundChat.value?.session.permissionMode || 'default'
  await sender.sendSetMode(chatId, mode)
}

// 文件输入引用
const fileInputRef = ref<HTMLInputElement | null>(null)

// 触发文件选择
const triggerFileInput = () => {
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    messageEditor.handleImageUpload(Array.from(files))
    // 重置 input 以便选择同一文件
    target.value = ''
  }
}
</script>
