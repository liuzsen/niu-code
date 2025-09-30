<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" modal header="Open Folder"
    :style="{ width: '600px' }" @show="onDialogShow">
    <div class="flex flex-col gap-4">
      <!-- Path Input -->
      <div class="flex items-center gap-2">
        <i class="pi pi-folder text-primary-500"></i>
        <InputText ref="pathInput" v-model="currentPath" placeholder="Enter folder path or select from list below"
          class="flex-1" @keyup.enter="handleEnterKey" />
        <Button label="Open" :disabled="!currentPath.trim()" @click="handlePathSubmit" severity="primary" />
      </div>

      <!-- Directory List -->
      <div class="bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
        <div v-if="loading" class="flex items-center justify-center py-8">
          <ProgressSpinner style="width: 32px; height: 32px" />
          <span class="ml-2 text-surface-600 dark:text-surface-400">Loading folders...</span>
        </div>

        <div v-else-if="filteredDirectoryItems.length === 0"
          class="flex flex-col items-center justify-center py-8 text-surface-500 dark:text-surface-400">
          <i class="pi pi-folder-open text-3xl mb-2"></i>
          <span>No matching folders found</span>
        </div>

        <div v-else class="max-h-64 overflow-y-auto custom-scrollbar">
          <div v-for="item in filteredDirectoryItems" :key="item.path"
            class="flex items-center gap-3 px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer transition-colors"
            :class="{
              'bg-surface-100 dark:bg-surface-700': selectedItem?.path === item.path,
              'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-primary-500': selectedItem?.path === item.path
            }" @click="handleItemClick(item)">
            <i class="pi pi-folder text-primary-500" />
            <span class="flex-1">{{ item.name }}</span>
          </div>
        </div>
      </div>

    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, inject } from 'vue'
import Fuse from 'fuse.js'
import { fileSystemService, type DirectoryItem } from '../services/fileSystemService'
import { recentProjectsStore } from '../services/recentProjects'
import { useWorkspace } from '../stores/workspace'
import { useChatManager } from '../stores/chatManager'
import type { MessageManager } from '../services/messageManager'

interface Props {
  visible: boolean
  initialPath?: string
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'select', path: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 注入服务
const workspace = useWorkspace()
const chatManager = useChatManager()
const messageManager = inject('messageManager') as MessageManager

const currentPath = ref(props.initialPath || '/')
const directoryItems = ref<DirectoryItem[]>([])
const selectedItem = ref<DirectoryItem | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const pathInput = ref<{ $el: HTMLInputElement } | null>(null)

// Fuse.js options for fuzzy matching
const fuseOptions = {
  keys: ['name', 'path'],
  threshold: 0.3, // Lower threshold = more strict matching
  includeScore: true,
  minMatchCharLength: 1
}

// Computed property for filtered directory items
const filteredDirectoryItems = computed(() => {
  if (!currentPath.value.trim() || directoryItems.value.length === 0) {
    return directoryItems.value
  }

  const fuse = new Fuse(directoryItems.value, fuseOptions)
  const searchTerm = currentPath.value.split('/').pop() || currentPath.value

  if (!searchTerm.trim()) {
    return directoryItems.value
  }

  const results = fuse.search(searchTerm)
  return results.map(result => result.item)
})

// Auto-select first item when filtering
watch(filteredDirectoryItems, (newItems) => {
  if (newItems.length > 0 && !selectedItem.value) {
    selectedItem.value = newItems[0]
  } else if (newItems.length === 0) {
    selectedItem.value = null
  }
}, { immediate: true })

const loadDirectory = async (path: string) => {
  loading.value = true
  error.value = null

  try {
    const response = await fileSystemService.listDirectory(path)
    directoryItems.value = response.items
    currentPath.value = response.currentPath
    selectedItem.value = null
  } catch (err) {
    error.value = 'Failed to load directory'
    console.error('Failed to load directory:', err)
  } finally {
    loading.value = false
  }
}

const handleItemClick = (item: DirectoryItem) => {
  selectedItem.value = item
  // Navigate to folder on single click
  navigateToFolder(item.path)
}

const navigateToFolder = async (path: string) => {
  await loadDirectory(path)
  // Add trailing slash to indicate it's a directory
  if (!currentPath.value.endsWith('/')) {
    currentPath.value = currentPath.value + '/'
  }
  // Focus back to input for continued typing
  nextTick(() => {
    pathInput.value?.$el?.focus()
  })
}

const handleEnterKey = async () => {
  const path = currentPath.value.trim()
  if (!path) return

  // If path ends with '/', treat as final confirmation (user just entered a folder)
  if (path.endsWith('/')) {
    await handlePathSubmit()
  }
  // If path doesn't end with '/' and we have a selected item, navigate into it
  else if (selectedItem.value) {
    await navigateToFolder(selectedItem.value.path)
  }
  // Otherwise, treat as final confirmation
  else {
    await handlePathSubmit()
  }
}

const handlePathSubmit = async () => {
  const path = currentPath.value.trim()
  if (!path) return

  try {
    // Validate path exists
    const valid = await fileSystemService.validatePath(path)
    if (valid) {
      emit('select', path)
      emit('update:visible', false)
      // Add to recent projects
      recentProjectsStore.add(path)

      // 启动新对话
      startNewChat(path)
    } else {
      error.value = 'Path does not exist'
    }
  } catch (err) {
    error.value = 'Failed to validate path'
    console.error('Failed to validate path:', err)
  }
}

// 启动新对话
const startNewChat = (path: string) => {
  // 设置工作目录
  workspace.setCwd(path)

  // 创建新对话
  const newChat = chatManager.newChat()

  // 如果 WebSocket 已连接，立即发送初始化消息
  // 如果未连接，handleWsConnected 会在连接后自动处理
  setTimeout(() => {
    if (messageManager && workspace.workingDirectory) {
      // 发送开始对话消息
      messageManager['ws'].sendMessage({
        chat_id: newChat.chatId,
        data: {
          kind: 'start_chat',
          work_dir: workspace.workingDirectory,
        }
      })

      // 发送获取信息消息
      messageManager['ws'].sendMessage({
        chat_id: newChat.chatId,
        data: {
          kind: 'get_info',
        }
      })
    }
  }, 5) // 小延迟确保状态更新
}


const onDialogShow = () => {
  loadDirectory(currentPath.value)
}

// Watch for visibility changes to reload directory
watch(() => props.visible, (newValue) => {
  if (newValue) {
    loadDirectory(currentPath.value)
  }
})
</script>