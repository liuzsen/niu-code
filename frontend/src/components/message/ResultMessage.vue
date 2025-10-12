<template>
  <div class="m-2 border border-border-subtle rounded-sm">
    <!-- Status Section -->
    <div>
      <div class="flex justify-between items-center px-4 py-3 border-b border-border-subtle">
        <div class="flex items-center gap-2 font-semibold text-sm"
          :class="props.data.subtype === 'success' ? 'text-status-success' : 'text-status-error'">
          <i :class="props.data.subtype === 'success' ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"></i>
          <span>{{ props.data.subtype === 'success' ? 'Success' : 'Error' }}</span>
        </div>
        <div class="flex gap-4 text-xs text-body-text">
          <span class="flex items-center gap-1 px-2 py-1 bg-surface-card rounded border border-border-subtle"
            v-if="duration">
            <i class="pi pi-clock text-xs mr-0.5"></i>
            {{ duration }}
          </span>
          <span class="flex items-center gap-1 px-2 py-1 bg-surface-card rounded border border-border-subtle"
            v-if="totalCost">
            ${{ totalCost }}
          </span>
        </div>
      </div>
    </div>

    <!-- Stats Section -->
    <div class="last:border-b-0 " v-if="stats.length > 0">
      <div class="p-4">
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3">
          <div
            class="flex items-center gap-3 p-3 rounded-lg border border-border-subtle neutral transition-all duration-200 hover:border-surface hover:shadow-md"
            v-for="stat in stats" :key="stat.label">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg text-sm">
              <i :class="getStatIcon(stat.label)"></i>
            </div>
            <div class="flex-1">
              <div class="text-xs mb-0.5">{{ stat.label }}</div>
              <div class="text-sm">{{ stat.value }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SDKResultMessage } from '@anthropic-ai/claude-code';
import { computed } from 'vue'

interface Props {
  data: SDKResultMessage
}

const props = defineProps<Props>()

// 计算属性
const duration = computed(() => {
  const seconds = props.data.duration_ms / 1000
  return seconds >= 1 ? `${seconds.toFixed(1)}s` : `${props.data.duration_ms}ms`
})

const totalCost = computed(() => {
  return props.data.total_cost_usd.toFixed(4)
})

const stats = computed(() => {
  const stats = []

  if (props.data.num_turns > 0) {
    stats.push({ label: 'Turns', value: props.data.num_turns })
  }

  if (props.data.usage.cache_read_input_tokens > 0) {
    stats.push({ label: 'Cache Read', value: props.data.usage.cache_read_input_tokens.toLocaleString() })
  }

  if (props.data.usage.input_tokens > 0) {
    stats.push({ label: 'Input Tokens', value: props.data.usage.input_tokens.toLocaleString() })
  }

  if (props.data.usage.output_tokens > 0) {
    stats.push({ label: 'Out Tokens', value: props.data.usage.output_tokens.toLocaleString() })
  }

  return stats
})

// 获取统计项图标
const getStatIcon = (label: string): string => {
  const iconMap: Record<string, string> = {
    'Turns': 'pi pi-sync',
    'Input Tokens': 'pi pi-arrow-down',
    'Output Tokens': 'pi pi-arrow-up',
    'Cache Read': 'pi pi-database'
  }
  return iconMap[label] || 'pi pi-chart-line'
}
</script>