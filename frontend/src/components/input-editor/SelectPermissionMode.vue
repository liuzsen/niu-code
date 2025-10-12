<template>
  <Select :modelValue="modelValue" @update:modelValue="onUpdate" :options="permissionModeOptions" optionLabel="label"
    optionValue="value" @change="onChange" class="h-7 text-sm bg-button-secondary-bg" :label-class="'px-2 pt-1 pb-0.5'"
    variant="filled" size="small" :pt="{
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
  </Select>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import type { PermissionMode } from '@anthropic-ai/claude-code'

interface Props {
  modelValue: PermissionMode | undefined
}

interface Emits {
  (e: 'update:modelValue', value: PermissionMode): void
  (e: 'change'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const permissionModeOptions = [
  { label: 'plan', value: 'plan' },
  { label: 'askBeforeEdits', value: 'default' },
  { label: 'autoEdits', value: 'acceptEdits' },
  { label: 'bypassPermissions', value: 'bypassPermissions' },
]

const onUpdate = (newValue: PermissionMode) => {
  emit('update:modelValue', newValue)
}

const onChange = () => {
  emit('change')
}

</script>
