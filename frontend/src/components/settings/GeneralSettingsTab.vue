<template>
  <div class="space-y-6">
    <!-- Appearance Section -->
    <div class="bg-surface-0 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-6">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-4">外观设置</h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-surface-900 dark:text-surface-0">主题模式</label>
            <p class="text-xs text-surface-600 dark:text-surface-400 mt-1">选择浅色或深色主题</p>
          </div>
          <Select v-model="localSettings.theme" :options="themeOptions" optionLabel="label" optionValue="value"
            placeholder="选择主题" class="w-48" @change="emitChange" />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-surface-900 dark:text-surface-0">语言</label>
            <p class="text-xs text-surface-600 dark:text-surface-400 mt-1">选择界面语言</p>
          </div>
          <Select v-model="localSettings.language" :options="languageOptions" optionLabel="label" optionValue="value"
            placeholder="选择语言" class="w-48" @change="emitChange" />
        </div>
      </div>
    </div>

    <!-- Editor Section -->
    <div class="bg-surface-0 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-6">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-4">编辑器设置</h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-surface-900 dark:text-surface-0">字体大小</label>
            <p class="text-xs text-surface-600 dark:text-surface-400 mt-1">调整编辑器字体大小</p>
          </div>
          <InputNumber v-model="localSettings.fontSize" suffix=" px" showButtons buttonLayout="horizontal" class=""
            @input="emitChange" />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-surface-900 dark:text-surface-0">自动保存</label>
            <p class="text-xs text-surface-600 dark:text-surface-400 mt-1">启用文件自动保存</p>
          </div>
          <ToggleSwitch v-model="localSettings.autoSave" @change="emitChange" />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-surface-900 dark:text-surface-0">行号显示</label>
            <p class="text-xs text-surface-600 dark:text-surface-400 mt-1">在编辑器中显示行号</p>
          </div>
          <ToggleSwitch v-model="localSettings.showLineNumbers" @change="emitChange" />
        </div>
      </div>
    </div>

    <!-- Notification Section -->
    <div class="bg-surface-0 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-6">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-4">通知设置</h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-surface-900 dark:text-surface-0">桌面通知</label>
            <p class="text-xs text-surface-600 dark:text-surface-400 mt-1">允许桌面通知</p>
          </div>
          <ToggleSwitch v-model="localSettings.desktopNotifications" @change="emitChange" />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-surface-900 dark:text-surface-0">声音提示</label>
            <p class="text-xs text-surface-600 dark:text-surface-400 mt-1">播放通知声音</p>
          </div>
          <ToggleSwitch v-model="localSettings.soundNotifications" @change="emitChange" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'

interface GeneralSettings {
  theme: string
  language: string
  fontSize: number
  autoSave: boolean
  showLineNumbers: boolean
  desktopNotifications: boolean
  soundNotifications: boolean
}

const props = defineProps<{
  modelValue: GeneralSettings
}>()

const emit = defineEmits<{
  'update:modelValue': [value: GeneralSettings]
  'change': []
}>()

const localSettings = ref<GeneralSettings>({ ...props.modelValue })

// Theme options
const themeOptions = [
  { label: '自动', value: 'auto' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' }
]

// Language options
const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]

const emitChange = () => {
  emit('update:modelValue', localSettings.value)
  emit('change')
}

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  localSettings.value = { ...newVal }
}, { deep: true })
</script>
