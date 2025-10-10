<template>
  <!-- Modal backdrop -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="py-8 fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="close">
        <div
          class="bg-surface-200 dark:bg-surface-950 rounded-lg shadow-2xl flex flex-col w-[600px] max-w-[90vw] h-[70vh]">
          <!-- Search input (fixed position) -->
          <div class="px-4 py-3 border-b border-surface-300 dark:border-surface-800 flex items-center gap-3 shrink-0">
            <i class="pi pi-search text-sm text-gray-500 dark:text-gray-400"></i>
            <input v-model="searchQuery" ref="searchInputRef" type="text" placeholder="搜索历史对话..."
              class="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-surface-200 placeholder-gray-500"
              @keydown="onKeyDown" />
            <span class="text-xs text-gray-500 dark:text-gray-400">ESC 关闭</span>
          </div>

          <!-- Results list (scrollable) -->
          <div class="overflow-y-auto flex-1 p-2">
            <template v-if="filteredItems.length">
              <button v-for="(item, index) in filteredItems" :key="item.timestamp"
                :ref="el => { if (selectedIndex === index) selectedItemRef = el as HTMLElement }"
                :class="{ 'bg-surface-400 dark:bg-surface-800': selectedIndex === index }" @click="selectItem(index)"
                class="items-start rounded-md cursor-pointer flex flex-col gap-1 p-3 text-left w-full transition-all duration-150 hover:bg-surface-300 dark:hover:bg-surface-900">
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

            <div class="text-gray-400 p-6 text-center text-sm" v-else>
              {{ searchQuery ? '无匹配历史记录' : '暂无历史记录' }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import type Fuse from 'fuse.js'
import type { PromptRecord } from '../../types/prompt'

interface Props {
  visible: boolean
  allPrompts: PromptRecord[]
  fuseInstance: Fuse<PromptRecord>
  onSelect: (content: string) => void
  onClose: () => void
}

const props = defineProps<Props>()

const selectedIndex = ref(0)
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const selectedItemRef = ref<HTMLElement | null>(null)

// Perform local search when searchQuery changes
const filteredItems = computed((): PromptRecord[] => {
  const query = searchQuery.value.trim()

  if (!query) {
    // No search query - show all prompts
    return props.allPrompts
  } else {
    // Use Fuse for fuzzy search
    const results = props.fuseInstance.search(query)
    return results.map(result => result.item)
  }
})

// Reset selection when filtered items change
watch(filteredItems, () => {
  selectedIndex.value = 0
})

// Reset search when modal opens
watch(() => props.visible, (visible) => {
  if (visible) {
    searchQuery.value = ''
    selectedIndex.value = 0
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
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

const scrollToSelected = () => {
  nextTick(() => {
    selectedItemRef.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    })
  })
}

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    upHandler()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    downHandler()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    enterHandler()
  }
}

const upHandler = () => {
  if (filteredItems.value.length === 0) return
  selectedIndex.value = (selectedIndex.value + filteredItems.value.length - 1) % filteredItems.value.length
  scrollToSelected()
}

const downHandler = () => {
  if (filteredItems.value.length === 0) return
  selectedIndex.value = (selectedIndex.value + 1) % filteredItems.value.length
  scrollToSelected()
}

const enterHandler = () => {
  selectItem(selectedIndex.value)
}

const selectItem = (index: number) => {
  const item = filteredItems.value[index]
  if (item) {
    props.onSelect(item.content)
  }
}

const close = () => {
  props.onClose()
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active>div,
.modal-leave-active>div {
  transition: transform 0.2s ease;
}

.modal-enter-from>div {
  transform: scale(0.95);
}

.modal-leave-to>div {
  transform: scale(0.95);
}
</style>
