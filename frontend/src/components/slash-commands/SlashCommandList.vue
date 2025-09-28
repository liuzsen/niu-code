<template>
  <div class="bg-surface-200 dark:bg-surface-950 rounded-lg shadow-lg flex flex-col gap-0.5 p-1 relative">
    <template v-if="items.length">
      <button v-for="(item, index) in items" :key="index"
        :class="{ ' bg-surface-400 dark:bg-surface-800': selectedIndex == index }" @click="selectItem(index)"
        class="items-center rounded-md text-white cursor-pointer flex gap-3 p-1 text-left w-full transition-all duration-150">
        <div class="flex flex-col gap-0.5 flex-1 min-w-0">
          <div class="font-semibold text-sm text-gray-800 dark:text-surface-200 leading-5 whitespace-nowrap">{{
            item.name }}</div>
          <div class="text-xs leading-4 text-gray-800 dark:text-surface-400 font-normal whitespace-nowrap">{{
            item.description }}</div>
        </div>
      </button>
    </template>

    <div class="text-gray-400 p-3 text-center text-sm" v-else-if="hasCommands">无匹配命令</div>
    <div class="text-gray-400 p-3 text-center text-sm" v-else>加载命令中...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useChatStore } from '../../stores/chat'
import type { CommandItem } from './SlashCommandSuggestion';

interface Props {
  items: CommandItem[]
  command: (item: CommandItem) => void
}

const props = defineProps<Props>()
const chatStore = useChatStore()

const selectedIndex = ref(0)

const hasCommands = computed(() => {
  return !!chatStore.systemInfo?.commands && chatStore.systemInfo.commands.length > 0
})

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
