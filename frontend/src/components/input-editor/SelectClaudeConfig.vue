<template>
  <Select v-model="selectedConfigName" :options="configOptions" optionLabel="label" optionValue="value"
    placeholder="选择配置" :disabled="disabled" class="h-7 text-sm bg-button-secondary-bg" :label-class="'px-2 pt-1 pb-0.5'"
    :pt="{
      dropdown: 'hidden',
      root: 'border border-border text-body-text',
      overlay: 'bg-elevated-bg border-0',
      label: 'text-body-text',
      option: ({ context }) => ({
        class: context.selected
          ? 'bg-active-bg hover:bg-hover-bg text-body-text'
          : 'bg-list-item-bg hover:bg-hover-bg text-body-text'
      })
    }" size="small">
  </Select>

</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Select from 'primevue/select'
import { apiService } from '../../services'
import type { ChatState } from '../../stores/chat'

interface Props {
  chat: ChatState | null
  disabled?: boolean
}

interface Emits {
  (e: 'update:configName', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 配置选择相关
const configOptions = ref<{ label: string; value: string }[]>([])

const selectedConfigName = computed({
  get: () => props.chat?.session.configName || '',
  set: (value: string) => {
    if (props.chat) {
      props.chat.setConfig(value)
      emit('update:configName', value)
    }
  }
})

// 加载配置列表
const loadConfigNames = async () => {
  const names = await apiService.getConfigNames()
  if (names) {
    configOptions.value = names.map(name => ({ label: name, value: name }))
  }
}

// 在组件挂载时加载配置列表
onMounted(() => {
  loadConfigNames()
})
</script>
