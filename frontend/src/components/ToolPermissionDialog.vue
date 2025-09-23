<template>
  <Dialog v-model:visible="visible" modal header="工具使用权限确认" :style="{ width: '500px' }" :closable="false">
    <div class="permission-content">
      <div class="permission-header">
        <i class="pi pi-shield text-2xl text-primary-500 mr-3"></i>
        <div>
          <h3 class="text-lg font-semibold">Claude 请求使用工具</h3>
          <p class="text-surface-500 dark:text-surface-400">
            请确认是否允许 Claude 使用以下工具
          </p>
        </div>
      </div>

      <div class="tool-info">
        <div class="tool-name">
          <span class="label">工具名称:</span>
          <span class="value font-mono">{{ request?.tool_name }}</span>
        </div>

        <div class="tool-input" v-if="request?.input">
          <span class="label">工具参数:</span>
          <pre class="input-content">{{ JSON.stringify(request.input, null, 2) }}</pre>
        </div>
      </div>

      <div class="suggestions" v-if="request?.suggestions?.length">
        <h4 class="suggestions-title">建议操作:</h4>
        <div class="suggestion-list">
          <Button v-for="(suggestion, index) in request.suggestions" :key="index"
            @click="() => approveWithSuggestion(suggestion)" label="批准并记住选择" class="suggestion-btn" severity="success"
            outlined size="small" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="拒绝" severity="danger" @click="denyPermission" class="deny-btn" size="small" />
        <Button label="允许" severity="secondary" @click="approvePermission" class="approve-btn" size="small" />
        <Button v-if="hasSuggestions" label="允许并记住选择" severity="success" @click="() => approveWithSuggestion()"
          class="approve-remember-btn" size="small" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useChatStore } from '../stores/chat'
import type { ExtendedPermissionResult, PermissionUpdate } from '../types/message'
import type { MessageManager } from '../services/messageManager'

interface Props {
  chatId: string
}

const props = defineProps<Props>()

const chatStore = useChatStore()
const messageManager = inject('messageManager') as MessageManager

const visible = computed({
  get: () => chatStore.pendingPermissionRequest !== null,
  set: (val) => !val && chatStore.handlePermissionResult()
})

const request = computed(() => chatStore.pendingPermissionRequest)
const hasSuggestions = computed(() => request.value?.suggestions && request.value.suggestions.length > 0)

// 拒绝权限
const denyPermission = () => {
  if (!request.value) return

  const result: ExtendedPermissionResult = {
    tool_use_id: request.value.tool_use_id,
    allowed: false,
    remember: false
  }

  messageManager.sendPermissionResponse(props.chatId, result)
  chatStore.handlePermissionResult()
}

// 允许权限
const approvePermission = () => {
  if (!request.value) return

  const result: ExtendedPermissionResult = {
    tool_use_id: request.value.tool_use_id,
    allowed: true,
    remember: false
  }

  messageManager.sendPermissionResponse(props.chatId, result)
  chatStore.handlePermissionResult()
}

// 允许权限并记住选择（应用建议）
const approveWithSuggestion = (suggestion?: PermissionUpdate) => {
  if (!request.value) return

  const result: ExtendedPermissionResult = {
    tool_use_id: request.value.tool_use_id,
    allowed: true,
    remember: true,
    suggestion: suggestion || request.value.suggestions?.[0]
  }

  messageManager.sendPermissionResponse(props.chatId, result)
  chatStore.handlePermissionResult()
}
</script>

<style scoped>
.permission-content {
  padding: 1rem 0;
}

.permission-header {
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--surface-100);
  border-radius: 0.5rem;
}

.tool-info {
  margin-bottom: 1.5rem;
}

.tool-name {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.label {
  font-weight: 600;
  color: var(--text-color-secondary);
  min-width: 100px;
  margin-right: 0.5rem;
}

.value {
  color: var(--text-color);
}

.tool-input {
  display: flex;
  flex-direction: column;
}

.input-content {
  background: var(--surface-50);
  border: 1px solid var(--surface-200);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  max-height: 200px;
  overflow-y: auto;
}

.suggestions {
  margin-top: 1.5rem;
}

.suggestions-title {
  font-weight: 600;
  color: var(--text-color-secondary);
  margin-bottom: 0.75rem;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.suggestion-btn {
  justify-content: flex-start;
  text-align: left;
}

.dialog-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.deny-btn {
  order: 1;
}

.approve-btn {
  order: 2;
}

.approve-remember-btn {
  order: 3;
}

:deep(.p-dialog-content) {
  padding: 0 1.5rem 1.5rem 1.5rem;
}

:deep(.p-dialog-footer) {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--surface-200);
}
</style>