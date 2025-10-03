<template>
  <header class="bg-surface-100 dark:bg-surface-800 p-4 flex items-center justify-between">
    <div class="flex items-center space-x-3">
      <i class="pi pi-comments text-xl"></i>
      <h1 class="text-lg font-semibold">Claude Code Web</h1>
    </div>

    <div class="flex items-center space-x-2">
      <div class="flex items-center space-x-2">
        <span class="pi pi-circle-fill text-sm"
          :class="{ 'text-green-500': isConnected, 'text-yellow-500': isConnecting, 'text-red-500': !isConnected && !isConnecting }"></span>
        <span class="text-sm" style="color: var(--text-color-secondary)">{{ connectionStatus }}</span>
      </div>
      <Button v-if="!isConnected" @click="connect" :loading="isConnecting" size="small" severity="info">
        Connect
      </Button>

      <!-- Mock File Selector (Dev only) -->
      <div v-if="isDevelopment" class="flex items-center space-x-2">
        <Select :options="mockOptions" v-model="selectedMockOption" @change="handleMockFileChange" optionLabel="label"
          optionValue="value" placeholder="选择 Mock 文件" class="w-48" size="small" />
      </div>

      <button type="button"
        class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-200 dark:hover:bg-surface-800 transition-all text-surface-900 dark:text-surface-0 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 dark:focus-visible:ring-offset-surface-950"
        @click="navigateToSettings">
        <i class="pi pi-cog text-base" />
      </button>
      <button type="button"
        class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-200 dark:hover:bg-surface-800 transition-all text-surface-900 dark:text-surface-0 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 dark:focus-visible:ring-offset-surface-950"
        @click="toggleDarkMode">
        <i :class="['pi text-base', { 'pi-moon': isDarkMode, 'pi-sun': !isDarkMode }]" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConnection } from '../composables/useConnection'
import { useLayout } from '../composables/useLayout'
import { mockFiles, currentMockFile, setSelectedMockFile, isDevelopment } from '../utils/mockLoader'
import { useToast } from 'primevue/usetoast'

const router = useRouter()
const { connectionStatus, isConnecting, isConnected, connect } = useConnection()
const { isDarkMode, toggleDarkMode } = useLayout()
const toast = useToast()

// Navigate to settings page
const navigateToSettings = () => {
  router.push('/settings')
}

// Mock file selector options
const mockOptions = computed(() => [
  { label: '正常模式', value: null },
  ...mockFiles.map(filename => ({ label: filename, value: filename }))
])

// Current selected option
const selectedMockOption = ref<string | null>(currentMockFile.value)

// Handle mock file selection change
const handleMockFileChange = () => {
  try {
    setSelectedMockFile(selectedMockOption.value)
  } catch {
    toast.add({
      severity: 'error',
      summary: '加载失败',
      detail: `无法加载 mock 文件`,
      life: 3000
    })
    selectedMockOption.value = null
  }
}

// Auto-connect on component mount
onMounted(() => {
  if (!isConnected.value) {
    connect()
  }
})

</script>