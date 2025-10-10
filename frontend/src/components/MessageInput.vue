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
          <Button v-if="!isGenerating" @click="handleSendUserInput" :disabled="!editable" icon="pi pi-arrow-up"
            severity="secondary" size="small"
            class="rounded-full w-10 h-10 p-0 shrink-0 transition-all duration-200 dark:bg-surface-950 dark:text-surface-300 bg-surface-300 text-surface-700"
            v-tooltip.top="{ value: 'Enter', pt: { text: 'bg-surface-300 dark:bg-surface-950 text-xs' } }"
            :title="disabledTooltip || '发送消息 (Enter)'" />

          <!-- Interrupt Button -->
          <Button v-else @click="handleStopGeneration" :disabled="!editable" icon="pi pi-stop" severity="secondary"
            size="small"
            class="rounded-full w-10 h-10 p-0 shrink-0 transition-all duration-200 bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700"
            v-tooltip.top="{ value: 'Ctrl + C', pt: { text: 'red dark:bg-surface-950 text-xs' } }"
            title="停止生成 (interrupt)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, computed, onMounted, onBeforeUnmount, ref } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { useChatStore } from '../stores/chat'
import { useMessageSender } from '../composables/useMessageSender'
import { useFileWatch } from '../composables/useFileWatch'
import { exportCurrentChat } from '../utils/chatExporter'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { DOMSerializer } from '@tiptap/pm/model'
import { htmlToMarkdown } from '../utils/contentConverter'
import { SlashCommandsExtension, suggestionOptions, slashCommandPluginKey } from './slash-commands'
import FileReferenceExtension from './file-reference/FileReferenceExtension'
import { fileReferencePluginKey } from './file-reference/FileReferenceSuggestion'
import { PromptHistoryExtension, createPromptHistorySuggestion, promptHistoryPluginKey } from './prompt-history'
import { promptHistoryService } from '../services/promptHistory'
import { useWorkspace } from '../stores/workspace'
import { apiService } from '../services'
import { useWebSocket } from '../composables/useWebSocket'
import type { PermissionMode } from '@anthropic-ai/claude-code'
import '../assets/tiptap.css'

const permissionModeOptions = [
  { label: 'plan', value: 'plan' },
  { label: 'askBeforeEdits', value: 'default' },
  { label: 'autoEdits', value: 'acceptEdits' },
  { label: 'bypassPermissions', value: 'bypassPermissions' },
]

// 使用新的 composables
const chatStore = useChatStore()
const { sendUserInput: sendMessage, sendSetMode, sendInterrupt } = useMessageSender()
const workspace = useWorkspace()
const { state: websocketState } = useWebSocket()

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
  const names = await apiService.getConfigNames()
  if (names) {
    configOptions.value = names.map(name => ({ label: name, value: name }))
  }
}

// 编辑器可用状态
const editable = computed(() => {
  if (websocketState.reconnecting) {
    return false
  }

  if (!workspace.hasWorkingDirectory) {
    return false
  }

  return true
})

// 禁用原因提示
const disabledTooltip = computed(() => {
  if (websocketState.reconnecting) {
    return 'WebSocket 正在重连，请稍候...'
  }

  if (!workspace.hasWorkingDirectory) {
    return '请先选择工作目录'
  }

  if (foregroundChat.value?.pendingRequest) {
    return '等待工具权限确认...'
  }

  return ''
})

// 按钮状态计算属性
const isGenerating = computed(() => foregroundChat.value?.isGenerating || false)

// 停止生成
const handleStopGeneration = () => {
  const chatId = foregroundChat.value?.chatId || ''
  if (chatId) {
    sendInterrupt(chatId)
  }
}

// 发送用户输入
const handleSendUserInput = async () => {
  if (!editor.value || editor.value.isEmpty) return

  const textContent = editor.value.getText()
  if (!textContent.trim()) return

  const htmlContent = editor.value.getHTML()
  const chatId = foregroundChat.value?.chatId || ''

  // 将 HTML 转换为 Markdown
  const markdownContent = htmlToMarkdown(htmlContent)

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
    PromptHistoryExtension.configure({
      suggestion: createPromptHistorySuggestion(),
    }),
  ],
  editable: editable.value,
  autofocus: true,
  onCreate: ({ editor }) => {
    editor.commands.focus()
  },
  editorProps: {
    clipboardTextSerializer: (slice) => {
      // 将 ProseMirror Slice 的内容转换为 HTML
      const div = document.createElement('div')

      // 从 slice 中获取 fragment 和 schema
      const fragment = slice.content
      const schema = fragment.firstChild?.type.schema || fragment.content[0]?.type.schema

      if (!schema) {
        // 如果无法获取 schema，返回纯文本
        return slice.content.textBetween(0, slice.content.size, '\n')
      }

      const serializer = DOMSerializer.fromSchema(schema)
      const domFragment = serializer.serializeFragment(fragment)
      div.appendChild(domFragment)

      const html = div.innerHTML

      // 转换为 Markdown
      return htmlToMarkdown(html)
    },
    handlePaste: (view, event,) => {
      const clipboardData = event.clipboardData
      if (!clipboardData) return false

      // 检查是否包含文件（图片）
      const files = Array.from(clipboardData.files)
      const images = files.filter(file => file.type.startsWith('image/'))

      if (images.length > 0) {
        // TODO: 处理图片粘贴
        console.log('Image pasted:', images)
        event.preventDefault()
        return true
      }

      // 处理纯文本粘贴 - 移除所有格式（包括代码块）
      const text = clipboardData.getData('text/plain')
      if (text) {
        // 直接插入纯文本，忽略 HTML 格式
        view.dispatch(view.state.tr.insertText(text))
        return true // 阻止默认的粘贴行为
      }

      return false // 让 TipTap 处理其他情况
    },
    handleKeyDown: (view, event) => {
      if (event.key === 'Enter' && event.shiftKey) {
        // Shift+Enter: 换行
        Object.defineProperty(event, 'shiftKey', {
          get: () => false
        })
        return false
      }

      // Ctrl+C: 停止生成（仅在无文本选中时）
      if (event.ctrlKey && event.key === 'c' && isGenerating.value) {
        // 检查是否有选中的文本
        const hasSelection = !view.state.selection.empty

        // 如果有选中文本，允许默认的复制行为
        if (hasSelection) {
          return false
        }

        // 没有选中文本时才执行停止生成
        event.preventDefault()
        handleStopGeneration()
        return true
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

        // 检查历史搜索建议列表是否正在显示
        const promptHistoryState = promptHistoryPluginKey.getState(view.state)
        if (promptHistoryState?.active) {
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

// 在组件挂载时加载配置列表和初始化历史服务
let unsubscribePromptHistory: (() => void) | null = null

onMounted(() => {
  loadConfigNames()

  // Subscribe to prompt history SSE with new pattern
  unsubscribePromptHistory = promptHistoryService.subscribe({
    onPromptReceived: (record) => {
      console.log('New prompt received:', record)
      // The service handles storing the prompt internally
    },
    onError: (error) => {
      console.error('Prompt history error:', error)
    }
  })
})

// Cleanup on unmount
onBeforeUnmount(() => {
  if (unsubscribePromptHistory) {
    unsubscribePromptHistory()
  }
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
