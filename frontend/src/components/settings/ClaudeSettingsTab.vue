<template>
  <div v-if="loading" class="text-center py-12">
    <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
    <p class="mt-4 text-surface-600 dark:text-surface-400">加载配置中...</p>
  </div>

  <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
    <div class="flex items-start gap-3">
      <i class="pi pi-exclamation-triangle text-red-600 dark:text-red-400 text-xl"></i>
      <div class="flex-1">
        <h3 class="font-semibold text-red-900 dark:text-red-100">加载配置失败</h3>
        <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ error }}</p>
      </div>
    </div>
  </div>

  <div v-else class="flex flex-col h-full">
    <!-- Header Section -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-surface-900 dark:text-surface-0">Claude 配置管理</h2>
          <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">
            配置 Claude 启动时使用的配置，配置内容的格式和 ~/.claude/settings.json 文件一致
          </p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="localSettings.claude_settings.length === 0"
      class="bg-surface-0 dark:bg-surface-800 rounded-lg border border-dashed border-surface-300 dark:border-surface-600 p-12 text-center">
      <i class="pi pi-inbox text-4xl text-surface-400 dark:text-surface-500"></i>
      <p class="text-surface-600 dark:text-surface-400 mt-4 font-medium">暂无 Claude 配置</p>
      <Button label="创建配置" icon="pi pi-plus" @click="addClaudeSetting" severity="success" class="mt-4" />
    </div>

    <!-- Tabs Container -->
    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <Tabs v-model:value="activeTabValue" class="flex-1 flex flex-col">
        <!-- Tab Headers -->
        <TabList>
          <Tab v-for="(setting, index) in localSettings.claude_settings" :key="index" :value="index">
            <div class="flex items-center gap-2">
              <i class="pi pi-cog text-sm"></i>
              <span>{{ setting.name || '未命名配置' }}</span>
              <button v-if="localSettings.claude_settings.length > 1"
                class="ml-2 hover:bg-surface-200 dark:hover:bg-surface-700 rounded p-1 transition-colors"
                @click.stop="removeClaudeSetting(index)">
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>
          </Tab>

          <!-- Add New Tab -->
          <Tab value="add-new" @click="handleAddTabClick">
            <div class="flex items-center gap-1 text-green-600 dark:text-green-400">
              <i class="pi pi-plus text-sm"></i>
              <span>新建</span>
            </div>
          </Tab>
        </TabList>

        <!-- Tab Panels -->
        <TabPanels class="flex-1 overflow-auto">
          <TabPanel v-for="(setting, index) in localSettings.claude_settings" :key="index" :value="index" class="">
            <div class="space-y-6">
              <!-- Config Name and Default Toggle -->
              <div class="flex items-start gap-4">
                <div class="flex-1">
                  <label class="block text-sm font-semibold text-surface-900 dark:text-surface-0 mb-2">
                    配置名称
                  </label>
                  <InputText v-model="setting.name" placeholder="请输入配置名称" class="w-full"
                    :class="{ '!border-red-500': !setting.name }" @input="emitChange" />
                  <p v-if="!setting.name" class="text-xs text-red-500 mt-1">配置名称不能为空</p>
                </div>

                <div class="flex items-center gap-2 pt-8">
                  <label class="text-sm font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap">
                    设为默认
                  </label>
                  <InputSwitch :model-value="localSettings.default_config === setting.name"
                    @update:model-value="(val: boolean) => toggleDefaultConfig(val, setting.name)"
                    v-tooltip="'将此配置设为新对话的默认配置'" />
                </div>
              </div>

              <!-- JSON Config -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-semibold text-surface-900 dark:text-surface-0">
                    配置内容 (JSON)
                  </label>
                  <div class="flex items-center gap-2">
                    <Button v-if="setting.jsonError" label="格式化" icon="pi pi-code" @click="formatJson(setting)" text
                      size="small" />
                    <span v-if="!setting.jsonError"
                      class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <i class="pi pi-check-circle"></i>
                      格式正确
                    </span>
                  </div>
                </div>

                <Textarea v-model="setting.settingJson" rows="16"
                  class="w-full font-mono text-sm bg-surface-50 dark:bg-surface-800"
                  :class="{ '!border-red-500': setting.jsonError }" @input="validateAndEmit(setting)"
                  placeholder='{\n  "env": {\n    "ANTHROPIC_AUTH_TOKEN": "your-secret-key",\n    "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456"\n  }\n}' />

                <!-- Error Message -->
                <div v-if="setting.jsonError"
                  class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <div class="flex items-start gap-2">
                    <i class="pi pi-times-circle text-red-600 dark:text-red-400 text-sm mt-0.5"></i>
                    <div class="flex-1">
                      <p class="text-xs text-red-700 dark:text-red-300 font-mono">{{ setting.jsonError }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputSwitch from 'primevue/inputswitch'
import Textarea from 'primevue/textarea'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useToast } from 'primevue/usetoast'
import type { Setting } from '../../services/api'

const toast = useToast()

interface LocalClaudeSetting {
  name: string
  settingJson: string
  jsonError: string | null
}

interface LocalSetting {
  claude_settings: LocalClaudeSetting[]
  default_config?: string
}

const props = defineProps<{
  modelValue: Setting
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Setting]
  'change': []
}>()

const loading = ref(false)
const error = ref<string | null>(null)
const activeTabValue = ref<number>(0)

const localSettings = ref<LocalSetting>({
  claude_settings: props.modelValue.claude_settings.map(cs => ({
    name: cs.name,
    settingJson: JSON.stringify(cs.setting, null, 2),
    jsonError: null
  })),
  default_config: props.modelValue.default_config
})

// Validate JSON
const validateJson = (setting: LocalClaudeSetting) => {
  try {
    JSON.parse(setting.settingJson)
    setting.jsonError = null
  } catch (e) {
    setting.jsonError = e instanceof Error ? e.message : 'Invalid JSON'
  }
}

const validateAndEmit = (setting: LocalClaudeSetting) => {
  validateJson(setting)
  emitChange()
}

// Format JSON
const formatJson = (setting: LocalClaudeSetting) => {
  try {
    const parsed = JSON.parse(setting.settingJson)
    setting.settingJson = JSON.stringify(parsed, null, 2)
    setting.jsonError = null
    emitChange()
    toast.add({
      severity: 'success',
      summary: '格式化成功',
      detail: 'JSON 已格式化',
      life: 2000
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: '格式化失败',
      detail: 'JSON 格式错误，无法格式化',
      life: 3000
    })
  }
}

// Check if there are any JSON errors
const hasJsonErrors = computed(() => {
  return localSettings.value.claude_settings.some(s => s.jsonError !== null || !s.name.trim())
})

// Handle add tab click (prevent switching to "add-new" tab)
const handleAddTabClick = (event: Event) => {
  event.preventDefault()
  addClaudeSetting()
}

// Add new Claude setting
const addClaudeSetting = () => {
  const defaultSetting = {
    env: {
      ANTHROPIC_AUTH_TOKEN: 'your-secret-key',
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:3456'
    }
  }
  const newIndex = localSettings.value.claude_settings.length
  localSettings.value.claude_settings.push({
    name: `config-${newIndex + 1}`,
    settingJson: JSON.stringify(defaultSetting, null, 2),
    jsonError: null
  })
  activeTabValue.value = newIndex
  emitChange()
}

// Remove Claude setting
const removeClaudeSetting = (index: number) => {
  const removedSetting = localSettings.value.claude_settings[index]

  // If removing the default config, clear default
  if (localSettings.value.default_config === removedSetting.name) {
    localSettings.value.default_config = undefined
  }

  localSettings.value.claude_settings.splice(index, 1)

  // Adjust active tab value if needed
  if (activeTabValue.value >= localSettings.value.claude_settings.length) {
    activeTabValue.value = Math.max(0, localSettings.value.claude_settings.length - 1)
  }

  emitChange()
}

// Toggle default config
const toggleDefaultConfig = (value: boolean, configName: string) => {
  if (value) {
    localSettings.value.default_config = configName
    toast.add({
      severity: 'success',
      summary: '已设为默认',
      detail: `"${configName}" 将用于新对话`,
      life: 2000
    })
  } else {
    localSettings.value.default_config = undefined
    toast.add({
      severity: 'info',
      summary: '已取消默认',
      detail: '新对话将不使用默认配置',
      life: 2000
    })
  }

  emitChange()
}

const emitChange = () => {
  if (!hasJsonErrors.value) {
    // Convert local settings back to API format
    const apiSettings: Setting = {
      claude_settings: localSettings.value.claude_settings.map(cs => ({
        name: cs.name,
        setting: JSON.parse(cs.settingJson) as Record<string, unknown>
      })),
      default_config: localSettings.value.default_config
    }
    emit('update:modelValue', apiSettings)
  }
  emit('change')
}

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  localSettings.value = {
    claude_settings: newVal.claude_settings.map(cs => ({
      name: cs.name,
      settingJson: JSON.stringify(cs.setting, null, 2),
      jsonError: null
    })),
    default_config: newVal.default_config
  }

  // Ensure active tab is valid
  if (activeTabValue.value >= localSettings.value.claude_settings.length) {
    activeTabValue.value = Math.max(0, localSettings.value.claude_settings.length - 1)
  }
}, { deep: true })
</script>
