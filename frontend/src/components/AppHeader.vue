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

      <!-- Mock Mode Toggle (Dev only) -->
      <div v-if="showMockToggle"
        class="flex items-center space-x-2 px-3 py-1 rounded-lg bg-surface-200 dark:bg-surface-700">
        <span class="text-sm font-medium"
          :class="{ 'text-green-600 dark:text-green-400': mockModeActive, 'text-surface-600 dark:text-surface-400': !mockModeActive }">
          Mock
        </span>
        <ToggleSwitch v-model="mockModeActive" @change="handleMockModeChange" size="small" />
      </div>

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
import ToggleSwitch from 'primevue/toggleswitch'
import { ref, watch, onMounted } from 'vue'
import { useConnection } from '../composables/useConnection'
import { useLayout } from '../composables/useLayout'
import { showMockToggle, isMockMode, toggleMockMode } from '../utils/mockLoader'

const { connectionStatus, isConnecting, isConnected, connect } = useConnection()
const { isDarkMode, toggleDarkMode } = useLayout()

// Mock mode state
const mockModeActive = ref(false)

// Sync with mock loader state
watch(isMockMode, (newValue) => {
  mockModeActive.value = newValue
}, { immediate: true })

// Handle mock mode toggle change
const handleMockModeChange = () => {
  toggleMockMode()
}

// Auto-connect on component mount
onMounted(() => {
  if (!isConnected.value) {
    connect()
  }
})

</script>