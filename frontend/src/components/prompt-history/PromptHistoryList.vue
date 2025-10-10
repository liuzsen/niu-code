<template>
  <div
    class="bg-surface-200 dark:bg-surface-950 rounded-lg shadow-lg flex flex-col gap-0.5 p-1 relative max-h-96 overflow-y-auto">
    <!-- Search hint -->
    <div class="px-3 py-2 border-b border-surface-300 dark:border-surface-800 flex items-center gap-2">
      <i class="pi pi-search text-xs text-gray-500 dark:text-gray-400"></i>
      <input v-model="searchQuery" ref="searchInputRef" type="text" placeholder="搜索历史对话..."
        class="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-surface-200 placeholder-gray-500"
        @keydown="onSearchKeyDown" />
      <span class="text-xs text-gray-500 dark:text-gray-400">Ctrl+R</span>
    </div>

    <!-- Results list -->
    <template v-if="filteredItems.length">
      <button v-for="(item, index) in filteredItems" :key="index"
        :class="{ ' bg-surface-400 dark:bg-surface-800': selectedIndex === index }" @click="selectItem(index)"
        class="items-start rounded-md cursor-pointer flex flex-col gap-1 p-2 text-left w-full transition-all duration-150 hover:bg-surface-300 dark:hover:bg-surface-900">
        <div class="flex items-center justify-between w-full gap-2">
          <div class="text-xs text-gray-500 dark:text-surface-400 font-mono">
            {{ formatTimestamp(item.timestamp) }}
          </div>
          <div v-if="item.work_dir" class="text-xs text-gray-500 dark:text-surface-500 truncate max-w-xs">
            {{ item.work_dir }}
          </div>
        </div>
        <div class="text-sm text-gray-800 dark:text-surface-200 leading-5 line-clamp-2">
          {{ item.content }}
        </div>
      </button>
    </template>

    <div class="text-gray-400 p-3 text-center text-sm" v-else>
      {{ searchQuery ? '无匹配历史记录' : '暂无历史记录' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import type Fuse from 'fuse.js'
import type { PromptHistoryItem } from './PromptHistorySuggestion'
import type { PromptRecord } from '../../types/prompt'

interface Props {
  items: PromptHistoryItem[]
  command: (item: PromptHistoryItem) => void
  query: string
  allPrompts: PromptRecord[]
  fuseInstance: Fuse<PromptRecord>
}

const props = defineProps<Props>()

const selectedIndex = ref(0)
const searchQuery = ref(props.query)
const searchInputRef = ref<HTMLInputElement | null>(null)

// Watch for external query changes (from editor input, though unlikely)
watch(() => props.query, (newQuery) => {
  searchQuery.value = newQuery
})

// Perform local search when searchQuery changes
const filteredItems = computed((): PromptHistoryItem[] => {
  const query = searchQuery.value.trim()

  let filteredPrompts: PromptRecord[]

  if (!query) {
    // No search query - show all prompts
    filteredPrompts = props.allPrompts
  } else {
    // Use Fuse for fuzzy search
    const results = props.fuseInstance.search(query)
    filteredPrompts = results.map(result => result.item)
  }

  // Convert to items with command
  return filteredPrompts.map(record => ({
    ...record,
    command: ({ editor }) => {
      // Replace entire content with selected prompt
      editor.chain().focus().deleteRange({ from: 0, to: editor.state.doc.content.size }).insertContent(record.content).run()
    }
  }))
})

// Reset selection when filtered items change
watch(filteredItems, () => {
  selectedIndex.value = 0
})

onMounted(() => {
  nextTick(() => {
    searchInputRef.value?.focus()
  })
})

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const onSearchKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') {
    event.preventDefault()
    // Delegate to main keyboard handler
    onKeyDown(event)
  }
}

const onKeyDown = (event: KeyboardEvent): boolean => {
  if (event.key === 'ArrowUp') {
    upHandler()
    return true
  }

  if (event.key === 'ArrowDown') {
    downHandler()
    return true
  }

  if (event.key === 'Enter') {
    enterHandler()
    return true
  }

  return false
}

const upHandler = () => {
  if (filteredItems.value.length === 0) return
  selectedIndex.value = (selectedIndex.value + filteredItems.value.length - 1) % filteredItems.value.length
}

const downHandler = () => {
  if (filteredItems.value.length === 0) return
  selectedIndex.value = (selectedIndex.value + 1) % filteredItems.value.length
}

const enterHandler = () => {
  selectItem(selectedIndex.value)
}

const selectItem = (index: number) => {
  const item = filteredItems.value[index]

  if (item) {
    props.command(item)
  }
}

defineExpose({
  onKeyDown,
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
