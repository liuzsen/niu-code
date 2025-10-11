<template>
  <div class="bg-surface-200 dark:bg-surface-950 rounded-lg shadow-lg flex flex-col gap-0.5 p-1 relative">
    <template v-if="items.length">
      <button v-for="(item, index) in items" :key="index"
        :class="{ ' bg-surface-400 dark:bg-surface-800': selectedIndex == index }" @click="selectItem(index)"
        class="items-center rounded-md text-white cursor-pointer flex gap-3 p-1 text-left w-full transition-all duration-150">
        <div class="flex flex-col gap-0.5 flex-1 min-w-0">
          <div class="font-mono text-sm text-gray-800 dark:text-surface-200 leading-5 truncate">
            {{ item.path }}
          </div>
        </div>
      </button>
    </template>

    <div class="text-gray-400 p-3 text-center text-sm" v-else>无匹配文件</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FileItem } from './config'

interface Props {
  items: FileItem[]
  command: (item: FileItem) => void
}

const props = defineProps<Props>()

const selectedIndex = ref(0)

watch(() => props.items, () => {
  selectedIndex.value = 0
})

const onKeyDown = (event: KeyboardEvent): boolean => {
  if (event.key === 'ArrowUp') {
    upHandler()
    return true
  }

  if (event.key === 'ArrowDown') {
    downHandler()
    return true
  }

  if (event.key === 'Enter') {
    enterHandler()
    return true
  }

  return false
}

const upHandler = () => {
  selectedIndex.value = (selectedIndex.value + props.items.length - 1) % props.items.length
}

const downHandler = () => {
  selectedIndex.value = (selectedIndex.value + 1) % props.items.length
}

const enterHandler = () => {
  selectItem(selectedIndex.value)
}

const selectItem = (index: number) => {
  const item = props.items[index]

  if (item) {
    props.command(item)
  }
}

defineExpose({
  onKeyDown
})
</script>
