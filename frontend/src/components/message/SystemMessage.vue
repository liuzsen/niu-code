<template>
  <div class="space-y-4 p-4">
    <div class="flex justify-between items-center pb-2 border-b border-border-subtle">
      <div class="flex items-center gap-2">
        <i class="pi pi-cog"></i>
        <span class="font-semibold text-heading-text">系统信息</span>
      </div>
      <span class="px-2 py-1 text-xs rounded-xl bg-code-inline-bg">{{ model
      }}</span>
    </div>

    <div class="space-y-2 text-xs flex flex-col gap-1 text-body-text font-medium">
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center">工作目录:</span>
        <span class="font-mono break-all text-sm bg-code-inline-bg rounded-sm px-2">{{ data.cwd }}</span>
      </div>
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center">会话 ID:</span>
        <span class="font-mono break-all text-sm bg-code-inline-bg rounded-sm px-2">{{ data.session_id }}</span>
      </div>
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center">权限模式:</span>
        <span class="px-2 py-1 text-sm rounded-full bg-button-secondary-bg">
          {{ data.permissionMode }}
        </span>
      </div>
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center max-h-6">可用工具:</span>
        <div class="flex flex-wrap gap-1">
          <span v-for="tool in data?.tools" :key="tool"
            class="px-2 py-1 text-xs bg-code-inline-bg text-caption-text rounded-full">
            {{ tool }}
          </span>
        </div>
      </div>
      <div class="flex gap-2">
        <span class="min-w-16 flex items-center max-h-6">斜杠命令:</span>
        <div class="flex flex-wrap gap-1">
          <span v-for="command in data.slash_commands" :key="command"
            class="px-2 py-1 text-xs bg-code-inline-bg rounded-full">
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
