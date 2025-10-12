<template>
  <div
    class="animate-attention bg-elevated-bg rounded-2xl p-4 border border-surface-500 dark:border-surface-700 outline-none shadow-sm"
    tabindex="0" ref="permissionContainer" @keydown="handleKeyDown">
    <div class="flex flex-col gap-1">
      <div class="flex mb-2 items-center">
        <div class="font-semibold">
          {{ questionText }}
        </div>
      </div>

      <div v-for="(option, index) in options" :key="option.id"
        class="cursor-pointer p-1 rounded-2xl border border-border transition-all duration-200" :class="{
          ' bg-active-bg': selectedIndex === index,
          'bg-list-item-bg': selectedIndex !== index

        }" @click="executeOption(option)" @mouseenter="selectedIndex = index">
        <div class="flex items-center gap-2">
          <i class="pi" :class="[option.icon, option.iconClass]"></i>
          <span :class="option.textClass" v-html="option.text"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef, type ComponentPublicInstance, onMounted } from 'vue'
import { usePermissionDialog, type PermissionOption } from '../composables/usePermissionDialog'
import type { ToolPermissionRequest } from '../types';

const props = defineProps<{
  request: ToolPermissionRequest
}>()

// Template ref
const permissionContainer = useTemplateRef<ComponentPublicInstance & { focus: () => void }>("permissionContainer")

// State
const selectedIndex = ref(0)

// Computed properties
const { questionText, options, escCallback } = usePermissionDialog(props.request)

// Navigation and execution
const handleKeyDown = (event: KeyboardEvent) => {
  const maxIndex = options.value.length - 1

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : maxIndex
      break
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = selectedIndex.value < maxIndex ? selectedIndex.value + 1 : 0
      break
    case 'Enter':
      event.preventDefault()
      executeSelectedOption()
      break
    case 'Escape':
      console.log('esc', escCallback)
      event.preventDefault()
      if (escCallback.value) {
        console.log("escCallback")
        escCallback.value()
      }
      break
  }
}

const executeOption = (option: PermissionOption) => {
  option.action()
}

const executeSelectedOption = () => {
  const selectedOption = options.value[selectedIndex.value]
  if (selectedOption) {
    executeOption(selectedOption)
  }
}

const focusDialog = () => {
  permissionContainer.value?.focus()
}

// Lifecycle
onMounted(() => {
  focusDialog()
})
</script>

<style scoped>
@reference "../style.css";

.permission-option {
  @apply cursor-pointer p-1 rounded-2xl border border-surface-400 transition-all duration-200;
}

.animate-attention {
  animation: shadow-glow 2s ease-in-out infinite;
}

@keyframes shadow-glow {
  50% {
    box-shadow:
      0 0 8px 4px rgba(22, 134, 220, 0.2),
      0 0 20px 6px rgba(31, 148, 238, 0.15),
      0 0 36px 8px rgba(44, 154, 244, 0.1);
  }
}
</style>
