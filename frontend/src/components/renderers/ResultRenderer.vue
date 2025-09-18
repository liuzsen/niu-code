<template>
  <div class="result-container">
    <!-- Status Section -->
    <div class="result-section status-section">
      <div class="section-header">
        <div class="result-status" :class="statusClass">
          <i :class="statusIcon"></i>
          <span>{{ statusText }}</span>
        </div>
        <div class="result-meta">
          <span class="result-duration" v-if="duration">
            <i class="pi pi-clock"></i>
            {{ duration }}
          </span>
          <span class="result-cost" v-if="totalCost">
            <i class="pi pi-dollar"></i>
            ${{ totalCost }}
          </span>
        </div>
      </div>
    </div>

    <!-- Stats Section -->
    <div class="result-section stats-section" v-if="stats.length > 0">
      <div class="section-header">
        <i class="pi pi-chart-bar"></i>
        <span>Statistics</span>
      </div>
      <div class="section-content">
        <div class="stats-grid">
          <div class="stat-item" v-for="stat in stats" :key="stat.label">
            <div class="stat-icon">
              <i :class="getStatIcon(stat.label)"></i>
            </div>
            <div class="stat-content">
              <div class="stat-label">{{ stat.label }}</div>
              <div class="stat-value">{{ stat.value }}</div>
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
  message: unknown
  data: SDKResultMessage
}

const props = defineProps<Props>()

const statusClass = computed(() => {
  return props.data.subtype === 'success' ? 'status-success' : 'status-error'
})

const statusIcon = computed(() => {
  return props.data.subtype === 'success' ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'
})

const statusText = computed(() => {
  return props.data.subtype === 'success' ? 'Success' : 'Error'
})

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
    stats.push({ label: 'Output Tokens', value: props.data.usage.output_tokens.toLocaleString() })
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

<style scoped>
.result-container {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
  margin: 8px 0;
  background-color: var(--surface-card);
}

/* 结果区域通用样式 */
.result-section {
  border-bottom: 1px solid var(--surface-border);
}

.result-section:last-child {
  border-bottom: none;
}

/* 区域标题样式 */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--surface-ground);
  border-bottom: 1px solid var(--surface-border);
  font-weight: 600;
  color: var(--text-color);
}

.section-header i {
  color: var(--primary-color);
  font-size: 0.875rem;
}

/* 区域内容样式 */
.section-content {
  padding: 16px;
}

/* 状态区域特殊样式 */
.status-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, var(--surface-ground) 0%, var(--surface-card) 100%);
}

.result-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.875rem;
}

.status-success {
  color: var(--green-600);
}

.status-error {
  color: var(--red-600);
}

.result-meta {
  display: flex;
  gap: 16px;
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.result-duration,
.result-cost {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: var(--surface-card);
  border-radius: 4px;
  border: 1px solid var(--surface-border);
}

/* 统计区域样式 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: var(--surface-ground);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
  transition: all 0.2s ease;
}

.stat-item:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: var(--primary-color);
  color: white;
  border-radius: 6px;
  font-size: 0.875rem;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  font-weight: 500;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 0.875rem;
  color: var(--text-color);
  font-weight: 600;
}
</style>