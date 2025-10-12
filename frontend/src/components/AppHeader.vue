<template>
  <header class="bg-panel-bg p-4 flex items-center justify-between border-b border-border">
    <div class="flex items-center space-x-3">
      <i class="pi pi-comments text-xl"></i>
      <h1 class="text-lg font-semibold text-heading-text">Claude Code Web</h1>
    </div>

    <div class="flex items-center space-x-2">
      <div class="flex items-center space-x-2">
        <span class="pi pi-circle-fill text-sm"
          :class="{ 'text-green-500': isConnected, 'text-yellow-500': isConnecting, 'text-red-500': !isConnected && !isConnecting }"></span>
        <span class="text-sm">{{ connectionStatus }}</span>
      </div>
      <Button v-if="!isConnected" @click="connect" :loading="isConnecting" size="small" severity="info">
        Connect
      </Button>

      <!-- Mock File Selector (Dev only) -->
      <div v-if="isDevelopment" class="flex items-center space-x-2">
        <Select :options="mockOptions" v-model="selectedMockOption" @change="handleMockFileChange" optionLabel="label"
          optionValue="value" placeholder="选择 Mock 文件" class="bg-button-secondary-bg" size="small" :pt="{
            dropdown: 'hidden',
            root: 'border border-border text-body-text',
            overlay: 'bg-elevated-bg border-0',
            label: 'text-body-text',
            option: ({ context }) => ({
              class: context.selected
                ? 'bg-active-bg hover:bg-hover-bg text-body-text'
                : 'bg-list-item-bg hover:bg-hover-bg text-body-text'
            })
          }" />
      </div>

      <!-- Theme Selector -->
      <Select v-model="themeStore.currentTheme" class="bg-button-secondary-bg" :options="themeOptions"
        optionLabel="label" optionValue="value" @change="handleThemeChange" placeholder="选择主题" size="small" :pt="{
          dropdown: 'hidden',
          root: 'border border-border text-body-text',
          overlay: 'bg-elevated-bg border-0',
          label: 'text-body-text',
          option: ({ context }) => ({
            class: context.selected
              ? 'bg-active-bg hover:bg-hover-bg text-body-text'
              : 'bg-list-item-bg hover:bg-hover-bg text-body-text'
          })
        }">
        <template #value="slotProps">
          <div v-if="slotProps.value" class="flex items-center gap-2">
            <i :class="getThemeIcon(slotProps.value as ThemePreset)" />
            <span>{{ themeStore.THEME_LABELS[slotProps.value as ThemePreset] }}</span>
          </div>
        </template>
        <template #option="slotProps">
          <div class="flex items-center gap-2">
            <i :class="getThemeIcon(slotProps.option.value)" />
            <span>{{ slotProps.option.label }}</span>
          </div>
        </template>
      </Select>

      <button type="button"
        class="w-10 h-10 flex items-center justify-center rounded-full bg-button-ghost-bg text-button-ghost-text hover:bg-hover-bg transition-all"
        @click="navigateToSettings">
        <i class="pi pi-cog text-base" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme, THEME_PRESETS, type ThemePreset } from '../stores/theme'
import { mockFiles, currentMockFile, setSelectedMockFile, isDevelopment } from '../utils/mockLoader'
import { useToast } from 'primevue/usetoast'
import { useWebSocket } from '../composables/useWebSocket'

const router = useRouter()
const { ws, state } = useWebSocket()
const isConnected = computed(() => state.connected)
const isConnecting = computed(() => state.connecting)

const connectionStatus = computed(() => {
  if (state.connected) return 'Connected'
  if (state.connecting) return 'Connecting...'
  return 'Disconnected'
})

const connect = () => {
  ws.connect()
}

const toast = useToast()
const themeStore = useTheme()

// Navigate to settings page
const navigateToSettings = () => {
  router.push('/settings')
}

// Theme selector options
const themeOptions = computed(() =>
  THEME_PRESETS.map(preset => ({
    label: themeStore.THEME_LABELS[preset],
    value: preset
  }))
)

// Handle theme change
const handleThemeChange = () => {
  themeStore.setTheme(themeStore.currentTheme)
}

// Get theme icon based on theme type
const getThemeIcon = (theme: ThemePreset) => {
  if (theme === 'dark') return 'pi pi-moon'
  if (theme === 'warm-light') return 'pi pi-sun text-orange-500'
  if (theme === 'cool-light') return 'pi pi-sun text-blue-500'
  return 'pi pi-palette'
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

</script>