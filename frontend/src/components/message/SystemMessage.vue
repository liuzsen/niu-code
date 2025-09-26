<template>
  <div class="space-y-4 p-4">
    <div class="flex justify-between items-center pb-2 border-b border-surface-500">
      <div class="flex items-center gap-2">
        <i class="pi pi-cog"></i>
        <span class="font-semibold text-surface-900 dark:text-surface-400">系统信息</span>
      </div>
      <span class="px-2 py-1 text-xs rounded-xl bg-surface-400 dark:bg-surface-900 dark:text-orange-400">{{ model
      }}</span>
    </div>

    <div class="space-y-2 text-xs flex flex-col gap-1 dark:text-surface-300 font-medium dark:font-semibold">
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center">工作目录:</span>
        <span class="font-mono break-all text-sm">{{ data.cwd }}</span>
      </div>
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center">会话 ID:</span>
        <span class="font-mono break-all text-sm">{{ data.session_id }}</span>
      </div>
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center">权限模式:</span>
        <span class="px-2 py-1 text-sm rounded-full" :class="{
          'bg-gray-500 text-surface-900': data.permissionMode === 'default',
          'bg-yellow-500 text-surface-900': data.permissionMode === 'acceptEdits',
          'bg-red-400 text-surface-900': data.permissionMode === 'bypassPermissions',
          'bg-green-500 text-surface-900': data.permissionMode === 'plan',
        }">
          {{ data.permissionMode }}
        </span>
      </div>
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center max-h-6">可用工具:</span>
        <div class="flex flex-wrap gap-1">
          <span v-for="tool in data?.tools" :key="tool"
            class="px-2 py-1 text-xs bg-surface-950 text-surface-300 rounded-full">
            {{ tool }}
          </span>
        </div>
      </div>
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center max-h-6">斜杠命令:</span>
        <div class="flex flex-wrap gap-1">
          <span v-for="command in data.slash_commands" :key="command"
            class="px-2 py-1 text-xs bg-surface-300 dark:bg-surface-900 rounded-full">
            /{{ command }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SDKSystemMessage } from '@anthropic-ai/claude-code'

interface Props {
  data: SDKSystemMessage
}

const props = defineProps<Props>()

// 获取模型信息
const model = computed(() => {
  return props.data?.model || 'Unknown'
})


</script>
