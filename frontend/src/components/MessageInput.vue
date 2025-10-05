<template>
  <div class="min-h-0">
    <div class="bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-500 rounded-2xl p-3 shadow-sm">
      <!-- Input Area -->
      <div class="mb-1">
        <div class="w-full resize-none border-0 bg-transparent min-h-20 px-2 focus:outline-2
          text-zinc-800 dark:text-slate-200 custom-tiptap-editor">
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
            @click="exportCurrentChat()" :disabled="foregroundChat?.messages.length === 0" title="导出对话" />
        </div>

        <!-- Right Side Buttons -->
        <div class="flex items-center gap-2">
          <!-- Config Name Selector -->
          <Select v-model="selectedConfigName" :options="configOptions" optionLabel="label" optionValue="value"
            placeholder="选择配置" :disabled="foregroundChat?.started()" class="h-7 text-sm no-dropdown"
            :label-class="'px-2 pt-1 pb-0.5'" size="small">
          </Select>

          <!-- Permission Mode Selector -->
          <Select :modelValue="foregroundChat?.session.permissionMode" @value-change="onPermissionModeUpdate"
            :options="permissionModeOptions" optionLabel="label" optionValue="value" @change="onPermissionModeChange"
            class="h-7 text-sm no-dropdown" :label-class="'px-2 pt-1 pb-0.5'" variant="filled" size="small"
            :pt="{ dropdownIcon: { class: ' bg-red' } }">
          </Select>

          <!-- Send Button -->
          <Button @click="handleSendUserInput" :disabled="!editable" icon="pi pi-arrow-up" severity="secondary"
            size="small"
            class="rounded-full w-10 h-10 p-0 shrink-0 dark:bg-surface-950 dark:text-surface-300 bg-surface-300 text-surface-700"
            v-tooltip.top="{ value: 'enter', pt: { text: 'bg-surface-300 dark:bg-surface-950 text-xs' } }"
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
import { watch, computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { useChatStore } from '../stores/chat'
import { useMessageSender } from '../composables/useMessageSender'
import { useFileWatch } from '../composables/useFileWatch'
import { exportCurrentChat } from '../utils/chatExporter'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { htmlToMarkdown } from '../utils/contentConverter'
import { SlashCommandsExtension, suggestionOptions, slashCommandPluginKey } from './slash-commands'
import FileReferenceExtension from './file-reference/FileReferenceExtension'
import { fileReferencePluginKey } from './file-reference/FileReferenceSuggestion'
import { useWorkspace } from '../stores/workspace'
import { apiService } from '../services/api'
import type { PermissionMode } from '@anthropic-ai/claude-code'
import '../assets/tiptap.css'

interface Props {
  error?: string
}

defineProps<Props>()

const permissionModeOptions = [
  { label: 'default', value: 'default' },
  { label: 'plan', value: 'plan' },
  { label: 'acceptEdits', value: 'acceptEdits' },
  { label: 'bypassPermissions', value: 'bypassPermissions' },
]

// 使用新的 composables
const chatStore = useChatStore()
const { sendUserInput: sendMessage, sendSetMode } = useMessageSender()
const workspace = useWorkspace()

// 初始化文件监听
useFileWatch()

const foregroundChat = computed(() => chatStore.foregroundChat)

// 配置选择相关
const configOptions = ref<{ label: string; value: string }[]>([])
const selectedConfigName = computed({
  get: () => foregroundChat.value?.session.configName || '',
  set: (value: string) => {
    if (foregroundChat.value?.session) {
      foregroundChat.value.session.configName = value
    }
  }
})

// 加载配置列表
const loadConfigNames = async () => {
  try {
    const names = await apiService.getConfigNames()
    configOptions.value = names.map(name => ({ label: name, value: name }))
  } catch (error) {
    console.error('Failed to load config names:', error)
  }
}

// 编辑器可用状态
const editable = computed(() => workspace.hasWorkingDirectory)

// 禁用原因提示
const disabledTooltip = computed(() => {
  if (!foregroundChat.value?.pendingRequest) return ''
  return '等待工具权限确认...'
})

// 发送用户输入
const handleSendUserInput = async () => {
  if (!editor.value || editor.value.isEmpty) return

  const textContent = editor.value.getText()
  if (!textContent.trim()) return

  const htmlContent = editor.value.getHTML()
  const chatId = foregroundChat.value?.chatId || ''

  // 将 HTML 转换为 Markdown
  const markdownContent = htmlToMarkdown(htmlContent)

  console.log(markdownContent)

  // 使用 composable 发送消息
  sendMessage(chatId, markdownContent)

  editor.value.commands.focus()
  editor.value.commands.clearContent()
}

// 初始化 TipTap 编辑器
const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({
      link: false,  // 禁用链接自动识别
    }),
    SlashCommandsExtension.configure({
      suggestion: suggestionOptions,
    }),
    FileReferenceExtension,
  ],
  editable: editable.value,
  autofocus: true,
  onCreate: ({ editor }) => {
    editor.commands.focus()
  },
  editorProps: {
    handleKeyDown: (view, event) => {
      if (event.key === 'Enter' && event.shiftKey) {
        // Shift+Enter: 换行
        Object.defineProperty(event, 'shiftKey', {
          get: () => false
        })
        return false
      }

      if (event.key === 'Enter') {
        // 检查斜杠命令建议列表是否正在显示
        const slashSuggestionState = slashCommandPluginKey.getState(view.state)
        if (slashSuggestionState?.active) {
          return false
        }

        // 检查文件引用建议列表是否正在显示
        const fileSuggestionState = fileReferencePluginKey.getState(view.state)
        if (fileSuggestionState?.active) {
          return false
        }

        // 建议列表未显示,发送消息
        handleSendUserInput()
        return true
      }
    },
    attributes: {
      class: 'prose prose-sm focus:outline-none',
    },
  }
})

// 监听禁用状态变化
watch(editable, (editable) => {
  if (editor.value) {
    editor.value.commands.focus()
    editor.value.setEditable(editable)
  }
}, { immediate: true })

// 在组件挂载时加载配置列表
onMounted(() => {
  loadConfigNames()
})

// 权限模式更新处理
const onPermissionModeUpdate = (newValue: PermissionMode) => {
  if (foregroundChat.value?.session) {
    foregroundChat.value.session.permissionMode = newValue
  }
}

// 权限模式变更处理
const onPermissionModeChange = async () => {
  const chatId = foregroundChat.value?.chatId || ''
  const mode = foregroundChat.value?.session.permissionMode || 'default'
  await sendSetMode(chatId, mode)
}
</script>

<style scoped>
.no-dropdown :deep(.p-select-dropdown) {
  display: none;
}
</style>
