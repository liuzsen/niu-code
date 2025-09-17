<template>
  <div class="system-renderer">
    <div class="system-header">
      <div class="system-title">
        <i class="pi pi-cog mr-2"></i>
        <span>系统初始化</span>
      </div>
      <Tag severity="info" :value="model" />
    </div>

    <div class="system-content">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">工作目录:</span>
          <span class="info-value">{{ data.cwd }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">会话 ID:</span>
          <span class="info-value">{{ data.session_id }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">权限模式:</span>
          <Tag :severity="getPermissionSeverity(data.permissionMode)">
            {{ data.permissionMode }}
          </Tag>
        </div>
        <div class="info-item">
          <span class="info-label">可用工具:</span>
          <div class="tools-list">
            <Tag v-for="tool in data?.tools?.slice(0, 8)" :key="tool" severity="secondary" :value="tool"
              class="tool-tag" />
            <span v-if="data.tools && data.tools.length > 8" class="more-tools">
              +{{ data.tools.length - 8 }} 更多
            </span>
          </div>
        </div>
        <div class="info-item">
          <span class="info-label">斜杠命令:</span>
          <div class="commands-list">
            <Tag v-for="command in data.slash_commands?.slice(0, 6)" :key="command" severity="secondary"
              :value="'/' + command" class="command-tag" />
            <span v-if="data.slash_commands && data.slash_commands.length > 6" class="more-commands">
              +{{ data.slash_commands.length - 6 }} 更多
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'
import type { ProjectClaudeMessage } from '../../types/claude'
import type { SDKSystemMessage } from '@anthropic-ai/claude-code'

interface Props {
  message: ProjectClaudeMessage
  data: SDKSystemMessage
}

const props = defineProps<Props>()

// 获取模型信息
const model = computed(() => {
  return props.data?.model || 'Unknown'
})

// 获取权限模式的严重程度
const getPermissionSeverity = (mode: string) => {
  switch (mode) {
    case 'bypassPermissions':
      return 'warning'
    case 'auto-allow':
      return 'success'
    case 'default':
      return 'info'
    default:
      return 'secondary'
  }
}

</script>

<style scoped>
.system-renderer {
  background-color: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
}

.system-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--surface-d);
}

.system-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: var(--text-color);
  font-size: 0.875rem;
}

.system-content {
  color: var(--text-color-secondary);
}

.info-grid {
  display: grid;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.info-label {
  font-weight: 500;
  color: var(--text-color);
  min-width: 80px;
  font-size: 0.813rem;
}

.info-value {
  color: var(--text-color-secondary);
  font-size: 0.813rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  word-break: break-all;
}

.tools-list,
.commands-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.tool-tag,
.command-tag {
  font-size: 0.75rem;
}

.more-tools,
.more-commands {
  color: var(--text-color-secondary);
  font-size: 0.75rem;
  margin-left: 0.25rem;
}
</style>