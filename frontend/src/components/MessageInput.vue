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
            placeholder="选择配置" :disabled="foregroundChat?.started()" @change="onConfigChange"
            class="h-7 text-sm no-dropdown" :label-class="'px-2 pt-1 pb-0.5'" size="small">
          </Select>

          <!-- Permission Mode Selector -->
          <Select :modelValue="foregroundChat?.session.permissionMode" @value-change="onPermissionModeUpdate"
            :options="permissionModeOptions" optionLabel="label" optionValue="value" @change="onPermissionModeChange"
            class="h-7 text-sm no-dropdown" :label-class="'px-2 pt-1 pb-0.5'" variant="filled" size="small"
            :pt="{ dropdownIcon: { class: ' bg-red' } }">
          </Select>

          <!-- Send Button -->
          <Button @click="sendUserInput" :disabled="!editable" icon="pi pi-arrow-up" severity="secondary" size="small"
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
import { watch, computed, onMounted, onUnmounted, ref } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { useChatManager } from '../stores/chatManager'
import { messageManager } from '../services/messageManager'
import { exportCurrentChat } from '../utils/chatExporter'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { htmlToMarkdown } from '../utils/contentConverter'
import { SlashCommandsExtension, suggestionOptions, slashCommandPluginKey } from './slash-commands'
import FileReferenceExtension from './file-reference/FileReferenceExtension'
import { loadFileList, addFileToCache, removeFileFromCache, fileReferencePluginKey } from './file-reference/FileReferenceSuggestion'
import { useWorkspace } from '../stores/workspace'
import { apiService } from '../services/api'
import { fileUpdateService } from '../services/fileUpdates'
import { useGlobalToast } from '../stores/toast'
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

// 使用导入的 messageManager
const chatManager = useChatManager()

const foregroundChat = computed(() => chatManager.foregroundChat)
const workspace = useWorkspace()
const toast = useGlobalToast()

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

// 配置变更处理
const onConfigChange = () => {
  // 配置名称已通过 v-model 更新到 foregroundChat.session.configName
  // 无需额外处理
}

// 组合的禁用状态
const editable = computed(() => workspace.hasWorkingDirectory)

// 禁用原因提示
const disabledTooltip = computed(() => {
  if (!foregroundChat.value?.pendingRequest) return ''

  return '等待工具权限确认...'
})

const sendUserInput = () => {
  if (!editor.value || editor.value.isEmpty) return

  const textContent = editor.value.getText()
  if (!textContent.trim()) return

  const htmlContent = editor.value.getHTML()

  const chatId = foregroundChat.value?.chatId || ''

  // 将 HTML 转换为 Markdown
  const markdownContent = htmlToMarkdown(htmlContent)

  console.log(markdownContent)

  messageManager.sendUserInput(chatId, markdownContent)

  editor.value.commands.focus();
  editor.value.commands.clearContent();
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
        // 修改事件的 shiftKey 属性，让后续处理器认为这是普通 Enter
        Object.defineProperty(event, 'shiftKey', {
          get: () => false
        })
        return false
      }

      if (event.key === 'Enter') {
        // 检查斜杠命令建议列表是否正在显示
        const slashSuggestionState = slashCommandPluginKey.getState(view.state)
        if (slashSuggestionState?.active) {
          // 如果建议列表正在显示,返回 false 让建议插件处理 Enter 键
          return false
        }

        // 检查文件引用建议列表是否正在显示
        const fileSuggestionState = fileReferencePluginKey.getState(view.state)
        if (fileSuggestionState?.active) {
          // 如果文件引用列表正在显示,返回 false 让建议插件处理 Enter 键
          return false
        }

        // 建议列表未显示,发送消息
        sendUserInput()
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

// 文件更新订阅管理
let unsubscribeFileUpdates: (() => void) | null = null

// 监听工作目录变化，加载文件列表并订阅文件更新
watch(() => workspace.workingDirectory, async (newDir) => {
  // 清理之前的订阅
  if (unsubscribeFileUpdates) {
    unsubscribeFileUpdates()
    unsubscribeFileUpdates = null
  }

  if (newDir) {
    try {
      // 初始加载文件列表
      const files = await apiService.getWorkspaceFiles(newDir)
      await loadFileList(files)
      console.log('File list loaded:', files.length, 'files')

      // 订阅文件更新
      unsubscribeFileUpdates = fileUpdateService.subscribe(
        newDir,
        {
          // 单个文件变更回调
          onFileChange: (type: 'created' | 'removed', file: string) => {
            try {
              console.log(`File ${type}:`, file)

              // 直接更新缓存，不需要重新拉取完整文件列表
              if (type === 'created') {
                addFileToCache(file)
              } else if (type === 'removed') {
                removeFileFromCache(file)
              }
            } catch (error) {
              console.error(`Failed to handle file ${type}:`, error)
            }
          },
          // 错误回调
          onError: (error: string) => {
            console.error('File update service error:', error)
            // 使用 toast 提示用户文件更新错误
            toast.add({
              severity: 'warn',
              summary: '文件更新错误',
              detail: `无法实时更新文件列表: ${error}`,
              life: 3000
            })
          }
        }
      )

      console.log('Subscribed to file updates for workDir:', newDir)
    } catch (error) {
      console.error('Failed to load file list:', error)
    }
  }
}, { immediate: true })

// 组件卸载时清理订阅
onUnmounted(() => {
  if (unsubscribeFileUpdates) {
    unsubscribeFileUpdates()
    unsubscribeFileUpdates = null
  }
})

// 权限模式更新处理
const onPermissionModeUpdate = (newValue: PermissionMode) => {
  if (foregroundChat.value?.session) {
    foregroundChat.value.session.permissionMode = newValue
  }
}

// 权限模式变更处理
const onPermissionModeChange = () => {
  // 发送模式更新消息到服务器
  const chatId = foregroundChat.value?.chatId || ''
  const mode = foregroundChat.value?.session.permissionMode || 'default'

  messageManager.sendSetMode(chatId, mode)
}

import type { PermissionMode } from '@anthropic-ai/claude-code'
</script>

<style scoped>
.no-dropdown :deep(.p-select-dropdown) {
  display: none;
}
</style>
