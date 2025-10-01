<template>
  <div v-if="visible" class="modal-overlay" @click="onOverlayClick">
    <div class="modal-container" @click.stop @keydown="handleKeyDown" tabindex="0">
      <div class="modal-header">
        <h3>选择要切换的会话</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>

      <div class="modal-body">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载会话列表...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <p class="error-text">{{ error }}</p>
          <button class="retry-btn" @click="loadSessions">重试</button>
        </div>

        <div v-else-if="sessions.length === 0" class="empty-state">
          <p>没有可切换的会话</p>
        </div>

        <div v-else class="session-list">
          <div v-for="(session, index) in sessions" :key="session.cli_id" ref="items"
            :class="['session-item', { 'selected': selectedIndex === index }]" @click="selectSession(index)"
            @dblclick="confirmSelection" tabindex="0">
            <div class="session-header">
              <span class="session-id">会话 #{{ session.cli_id }}</span>
              <span class="session-time">{{ formatTime(session.last_activity) }}</span>
            </div>
            <div class="session-info">
              <div class="work-dir">📁 {{ session.work_dir }}</div>
              <div class="message-count">💬 {{ session.message_count }} 条消息</div>
            </div>
            <div v-if="session.last_uesr_input" class="last-input">
              {{ truncate(session.last_uesr_input, 80) }}
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="close">取消</button>
        <button class="btn btn-primary" :disabled="selectedIndex === -1 || loading" @click="confirmSelection">
          切换
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, useTemplateRef } from 'vue'
import { useSessionSwitch } from '../composables/useSessionSwitch'
import type { SessionInfo } from '../types/session'

const {
  isSessionListVisible,
  loadActiveSessions,
  switchToSession
} = useSessionSwitch()

const visible = ref(false)
const sessions = ref<SessionInfo[]>([])
const selectedIndex = ref(-1)
const loading = ref(false)
const error = ref<string | null>(null)
const itemRefs = useTemplateRef<HTMLElement[]>('items')

watch(isSessionListVisible, (newVal) => {
  visible.value = newVal
  if (newVal) {
    loadSessions()
  }
})

async function loadSessions() {
  loading.value = true
  error.value = null
  try {
    sessions.value = await loadActiveSessions()
    // 按最后活动时间倒序排列
    sessions.value.sort((a, b) =>
      new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
    )
    selectedIndex.value = sessions.value.length > 0 ? 0 : -1

    // 滚动到选中项
    if (selectedIndex.value >= 0) {
      await nextTick()
      scrollToSelected()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function selectSession(index: number) {
  selectedIndex.value = index
  scrollToSelected()
}

function scrollToSelected() {
  if (itemRefs.value && selectedIndex.value >= 0 && itemRefs.value[selectedIndex.value]) {
    itemRefs.value[selectedIndex.value].scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    })
  }
}

async function confirmSelection() {
  if (selectedIndex.value === -1 || loading.value) return
  const session = sessions.value[selectedIndex.value]

  try {
    loading.value = true
    await switchToSession(session.cli_id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '切换会话失败'
  } finally {
    loading.value = false
  }
}

function close() {
  isSessionListVisible.value = false
}

function onOverlayClick() {
  close()
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}小时前`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}天前`

  return date.toLocaleDateString()
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}


// 键盘事件处理函数
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value > 0) {
      selectedIndex.value--
      scrollToSelected()
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value < sessions.value.length - 1) {
      selectedIndex.value++
      scrollToSelected()
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    confirmSelection()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

// 当模态框显示时自动聚焦到容器
watch(visible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      const container = document.querySelector('.modal-container') as HTMLElement
      container?.focus()
    })
  }
})

</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.close-btn:hover {
  color: #374151;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.error-text {
  color: #dc2626;
  margin-bottom: 1rem;
}

.retry-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.retry-btn:hover {
  background: #2563eb;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.session-item {
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.session-item:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}

.session-item.selected {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 1px #3b82f6;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.session-id {
  font-weight: 600;
  color: #111827;
}

.session-time {
  color: #6b7280;
  font-size: 0.875rem;
}

.session-info {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #4b5563;
}

.last-input {
  color: #6b7280;
  font-size: 0.875rem;
  font-style: italic;
  background: #f9fafb;
  padding: 0.5rem;
  border-radius: 4px;
  border-left: 3px solid #e5e7eb;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .modal-container {
    background: #1f2937;
    color: #f9fafb;
  }

  .modal-header {
    border-bottom-color: #374151;
  }

  .session-item {
    border-color: #374151;
    background: #111827;
  }

  .session-item:hover {
    background: #1f2937;
    border-color: #3b82f6;
  }

  .session-item.selected {
    background: #1e3a8a;
    border-color: #3b82f6;
  }

  .last-input {
    background: #374151;
    border-left-color: #4b5563;
    color: #d1d5db;
  }

  .modal-footer {
    border-top-color: #374151;
  }

  .btn-secondary {
    background: #374151;
    color: #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #4b5563;
  }
}
</style>