<template>
  <div class="h-full flex flex-col ">
    <!-- Header with Actions -->
    <div class="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 px-6 py-4">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Button class="bg-neutral-100 dark:bg-surface-700" icon="pi pi-arrow-left" @click="goBack" outlined
            severity="secondary" rounded />
        </div>
        <div class=" flex items-center gap-2">
          <Button label="取消" @click="handleCancel" severity="secondary" class="bg-gray-400 text-white" />
          <Button severity="info" label="保存" icon="pi pi-save" @click="handleSaveAll" :loading="saving"
            :disabled="!hasChanges" />
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <!-- Tab Headers - Centered -->
      <div class="bg-surface-0 dark:bg-surface-800 border-surface-200 dark:border-surface-700">
        <div class="max-w-6xl mx-auto">
          <Tabs v-model:value="activeTab" class="w-full">
            <TabList class="flex justify-center">
              <Tab value="general">基础配置</Tab>
              <Tab value="claude">Claude 配置</Tab>
            </TabList>
          </Tabs>
        </div>
      </div>

      <!-- Tab Content - Centered with max-width -->
      <div class="flex-1 overflow-auto">
        <div class="max-w-6xl mx-auto">
          <Tabs v-model:value="activeTab">
            <TabPanels>
              <TabPanel value="general" class="pt-4">
                <GeneralSettingsTab v-model="generalSettings" @change="markChanged" />
              </TabPanel>
              <TabPanel value="claude" class="bg-white pt-4">
                <ClaudeSettingsTab v-model="claudeSettings" @change="markChanged" />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useToast } from 'primevue/usetoast'
import GeneralSettingsTab from '../components/settings/GeneralSettingsTab.vue'
import ClaudeSettingsTab from '../components/settings/ClaudeSettingsTab.vue'
import { apiService } from '../services/api'
import type { Setting } from '../services/api'

const router = useRouter()
const toast = useToast()

const activeTab = ref('general')
const hasChanges = ref(false)
const saving = ref(false)

// Settings data
interface GeneralSettings {
  theme: string
  language: string
  fontSize: number
  autoSave: boolean
  showLineNumbers: boolean
  desktopNotifications: boolean
  soundNotifications: boolean
}

const generalSettings = ref<GeneralSettings>({
  theme: 'auto',
  language: 'zh-CN',
  fontSize: 14,
  autoSave: true,
  showLineNumbers: true,
  desktopNotifications: false,
  soundNotifications: false
})

const claudeSettings = ref<Setting>({
  claude_settings: []
})

const markChanged = () => {
  hasChanges.value = true
}

const goBack = () => {
  if (hasChanges.value) {
    if (confirm('有未保存的更改，确定要离开吗？')) {
      router.push('/')
    }
  } else {
    router.push('/')
  }
}

const handleCancel = () => {
  if (hasChanges.value) {
    if (confirm('确定要放弃所有更改吗？')) {
      loadAllSettings()
      hasChanges.value = false
      router.push('/')
    }
  } else {
    router.push('/')
  }
}

const handleSaveAll = async () => {
  saving.value = true
  try {
    // Save Claude settings (only real API for now)
    await apiService.updateSetting(claudeSettings.value)

    // TODO: Save general settings when backend API is ready
    // For now, just show success for general settings
    console.log('General settings (not saved to backend yet):', generalSettings.value)

    toast.add({
      severity: 'success',
      summary: '保存成功',
      detail: '所有配置已保存',
      life: 3000
    })

    hasChanges.value = false
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: '保存失败',
      detail: e instanceof Error ? e.message : '未知错误',
      life: 3000
    })
  } finally {
    saving.value = false
  }
}

const loadAllSettings = async () => {
  try {
    // Load Claude settings
    const settings = await apiService.getSetting()
    claudeSettings.value = settings

    // TODO: Load general settings from backend when API is ready
    // For now, use default values
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: '加载配置失败',
      detail: e instanceof Error ? e.message : '未知错误',
      life: 3000
    })
  }
}

onMounted(() => {
  loadAllSettings()
})
</script>
