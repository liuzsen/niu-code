<template>
  <div class="max-w-4xl mx-auto">
    <!-- Welcome Header -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-semibold text-surface-800 dark:text-surface-100 mb-2">
        Welcome to Claude Code Web
      </h1>
      <p class="text-lg text-surface-600 dark:text-surface-400">
        Select a workspace folder to start coding with Claude
      </p>
    </div>

    <!-- Search Projects -->
    <div class="bg-surface-50 dark:bg-surface-800 rounded-lg p-6 border border-surface-200 dark:border-surface-700">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <i class="pi pi-search text-2xl text-primary-500"></i>
          <h3 class="text-lg font-medium text-surface-800 dark:text-surface-100">
            Search Projects
          </h3>
        </div>
        <Button label="Open Folder..." icon="pi pi-folder-open" @click="showDirectoryPicker = true" severity="primary"
          size="small" />
      </div>

      <div class="relative">
        <InputText v-model="searchQuery" placeholder="Search by project name or path..." class="w-full" :pt="{
          root: {
            class: 'pr-10'
          }
        }" />
        <i v-if="!searchQuery"
          class="pi pi-search absolute right-3 top-1/2 transform -translate-y-1/2 text-surface-400" />
        <Button v-else icon="pi pi-times" text size="small" class="absolute right-2 top-1/2 transform -translate-y-1/2"
          @click="searchQuery = ''" />
      </div>

      <div v-if="searchResults.length > 0" class="mt-4 space-y-2">
        <div v-for="project in searchResults" :key="project.path"
          class="p-3 rounded bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors cursor-pointer"
          @click="openProject(project.path)">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="pi pi-folder text-primary-500"></i>
              <span class="font-medium text-surface-800 dark:text-surface-100">
                {{ project.name }}
              </span>
            </div>
            <span class="text-xs text-surface-500 dark:text-surface-400">
              {{ formatDate(project.lastOpened) }}
            </span>
          </div>
          <div class="text-sm text-surface-600 dark:text-surface-400 mt-1">
            {{ project.path }}
          </div>
        </div>
      </div>
      <div v-else-if="searchQuery" class="mt-4 text-surface-500 dark:text-surface-400 text-sm">
        No projects found matching "{{ searchQuery }}"
      </div>
      <div v-else-if="recentProjects.length === 0" class="mt-4 text-surface-500 dark:text-surface-400 text-sm">
        No recent projects yet. Click "Open Folder" to get started.
      </div>
    </div>

    <!-- Directory Picker Modal -->
    <DirectoryPicker v-model:visible="showDirectoryPicker" @select="handleDirectorySelect" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import Fuse from 'fuse.js'
import DirectoryPicker from './DirectoryPicker.vue'
import { recentProjectsStore, type RecentProject } from '../services/recentProjects'
import { useWorkspace } from '../stores/workspace'
import { useChatManager } from '../stores/chatManager'
import type { MessageManager } from '../services/messageManager'

const workspace = useWorkspace()
const chatManager = useChatManager()
const messageManager = inject('messageManager') as MessageManager
const showDirectoryPicker = ref(false)
const searchQuery = ref('')
const recentProjects = ref<RecentProject[]>([])

// Fuse.js configuration for fuzzy search
const fuseOptions = {
  keys: ['name', 'path'],
  threshold: 0.3, // Lower threshold = more strict matching
  includeScore: true,
  minMatchCharLength: 1
}

// Fuse instance created dynamically with recent projects
const fuseInstance = computed(() => {
  return new Fuse(recentProjects.value, fuseOptions)
})

// Search results using fuzzy search
const searchResults = computed(() => {
  if (!searchQuery.value.trim()) {
    return recentProjects.value
  }

  const results = fuseInstance.value.search(searchQuery.value)
  return results.map(result => result.item)
})

const loadRecentProjects = () => {
  recentProjects.value = recentProjectsStore.get()
}

const openProject = (path: string) => {
  workspace.setCwd(path)
  // Add to recent projects
  recentProjectsStore.add(path)
  loadRecentProjects()

  // 启动新对话
  startNewChat()
}

const handleDirectorySelect = (path: string) => {
  workspace.setCwd(path)
  loadRecentProjects()

  // 启动新对话
  startNewChat()
}

// 启动新对话
const startNewChat = () => {
  // 创建新对话
  const newChat = chatManager.newChat()

  // 如果 WebSocket 已连接，立即发送初始化消息
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
  }, 100) // 小延迟确保状态更新
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

onMounted(() => {
  loadRecentProjects()
})
</script>