<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" modal header="Open Folder"
    :style="{ width: '600px' }" @show="onDialogShow">
    <div class="flex flex-col gap-4">
      <!-- Path Input -->
      <div class="flex items-center gap-2">
        <InputText v-model="currentPath" placeholder="Enter folder path" class="flex-1" @keydown="handleKeyDown" />
        <Button label="Open" :disabled="!currentPath.trim()" @click="handlePathSubmit" severity="primary" />
      </div>

      <!-- Directory List -->
      <div
        class="bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 h-120 overflow-auto">
        <div v-if="loading" class="flex items-center justify-center py-8">
          <ProgressSpinner style="width: 32px; height: 32px" />
          <span class="ml-2 text-surface-600 dark:text-surface-400">
            {{ isSearching ? 'Searching...' : 'Loading folders...' }}
          </span>
        </div>

        <div v-else-if="filteredDirectoryItems.length === 0"
          class="flex flex-col items-center justify-center py-8 text-surface-500 dark:text-surface-400">
          <i class="pi pi-folder-open text-3xl mb-2"></i>
          <span>
            {{ isSearching ? 'No results found' : 'No matching folders found' }}
          </span>
        </div>

        <div v-else class="">
          <div v-for="(item, index) in filteredDirectoryItems" :key="item.path"
            class="flex items-center gap-3 px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer transition-colors"
            :class="{
              'bg-surface-100 dark:bg-surface-700': selectedIndex === index,
              'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-primary-500': selectedIndex === index
            }" @click="handleItemClick(item, index)">
            <i class="pi pi-folder text-primary-500" />
            <span class="flex-1">{{ item.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { apiService } from '../services/api'

interface Props {
  visible: boolean
  initialPath?: string
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'select', path: string): void
}

interface DirectoryItem {
  name: string
  path: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const currentPath = ref('')
const directoryItems = ref<DirectoryItem[]>([])
const selectedIndex = ref(0)
const loading = ref(false)
const pathInput = ref<{ $el: HTMLInputElement } | null>(null)

// Cache for storing directory listings
const directoryCache = ref<Map<string, string[]>>(new Map())

// Enhanced loading states
const isSearching = ref(false)

// Debounced search filtering
const searchDebounce = ref<number | null>(null)
const searchQuery = ref('')

// Filter directory items based on current path (excluding trailing slash)
const filteredDirectoryItems = computed(() => {
  const path = currentPath.value.trim()
  if (!path || path.endsWith('/')) {
    return directoryItems.value
  }

  const searchTerm = searchQuery.value
  if (!searchTerm) {
    return directoryItems.value
  }

  // Enhanced fuzzy matching with better scoring
  const items = [...directoryItems.value]

  return items
    .map(item => {
      const nameLower = item.name.toLowerCase()
      const searchLower = searchTerm.toLowerCase()

      let score = 0

      // Exact match gets highest score
      if (nameLower === searchLower) {
        score = 1000
      }
      // Starts with gets high score
      else if (nameLower.startsWith(searchLower)) {
        score = 100
      }
      // Contains gets medium score
      else if (nameLower.includes(searchLower)) {
        score = 10
      }
      // Character-by-character match for fuzzy search
      else {
        let searchIndex = 0
        for (let i = 0; i < nameLower.length && searchIndex < searchLower.length; i++) {
          if (nameLower[i] === searchLower[searchIndex]) {
            searchIndex++
          }
        }
        if (searchIndex === searchLower.length) {
          score = 5
        }
      }

      return { item, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
})

// Watch current path for auto-navigation with debounced search
watch(currentPath, async (newPath) => {
  const path = newPath.trim()
  if (!path) return

  // Clear previous debounce
  if (searchDebounce.value) {
    clearTimeout(searchDebounce.value)
  }

  if (path.endsWith('/')) {
    // Path ends with '/', load this directory
    await loadDirectory(path)
    searchQuery.value = ''
  } else {
    // Extract search term for filtering
    const searchTerm = path.split('/').pop() || path
    searchQuery.value = searchTerm

    // Load parent directory for filtering with debounce
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/'
    isSearching.value = true
    await loadDirectory(parentPath)
    isSearching.value = false
  }
})

// Watch filtered items to reset selection
watch(filteredDirectoryItems, (newItems) => {
  selectedIndex.value = newItems.length > 0 ? 0 : -1
}, { immediate: true })

const loadDirectory = async (path: string) => {
  loading.value = true

  // Check cache first
  if (directoryCache.value.has(path)) {
    const cachedEntries = directoryCache.value.get(path)!
    directoryItems.value = cachedEntries
      .filter(entry => entry !== '.' && entry !== '..')
      .map(entry => ({
        name: entry,
        path: path + (path.endsWith('/') ? '' : '/') + entry
      }))
    selectedIndex.value = directoryItems.value.length > 0 ? 0 : -1
    loading.value = false
    return
  }

  const entries = await apiService.ls(path)

  if (!entries) {
    directoryItems.value = []
    selectedIndex.value = -1
    loading.value = false
    return
  }

  // Cache the results
  directoryCache.value.set(path, entries)

  directoryItems.value = entries
    .filter(entry => entry !== '.' && entry !== '..')
    .map(entry => ({
      name: entry,
      path: path + (path.endsWith('/') ? '' : '/') + entry
    }))
  selectedIndex.value = directoryItems.value.length > 0 ? 0 : -1
  loading.value = false
}

const handleItemClick = (item: DirectoryItem, index: number) => {
  selectedIndex.value = index
  navigateToFolder(item.path)
}

const navigateToFolder = (path: string) => {
  currentPath.value = path + '/'
  nextTick(() => {
    pathInput.value?.$el?.focus()
  })
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (selectedIndex.value < filteredDirectoryItems.value.length - 1) {
      selectedIndex.value++
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    }
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const selectedItem = filteredDirectoryItems.value[selectedIndex.value]
    if (selectedItem) {
      navigateToFolder(selectedItem.path)
    } else if (currentPath.value.trim()) {
      handlePathSubmit()
    }
  }
}

const handlePathSubmit = async () => {
  const path = currentPath.value.trim()
  if (!path) return

  try {
    emit('select', path)
    emit('update:visible', false)
  } catch (err) {
    console.error('Failed to select path:', err)
  }
}

const onDialogShow = async () => {
  const homePath = await apiService.getHome()
  if (homePath) {
    currentPath.value = homePath + '/'
  } else {
    currentPath.value = '/'
  }
}

// Focus input when dialog opens
watch(() => props.visible, (newValue) => {
  if (newValue) {
    nextTick(() => {
      pathInput.value?.$el?.focus()
    })
  }
})
</script>