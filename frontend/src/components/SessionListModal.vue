<template>
  <Dialog v-model:visible="visible" modal header="选择要切换的会话" :style="{ width: '90vw', maxWidth: '600px' }"
    :maximizable="false" :draggable="false" :dismissableMask="true" @keydown="handleKeyDown" @hide="close"
    class="session-selector-dialog">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <h3 class="m-0 text-lg font-semibold text-surface-900 dark:text-surface-0">
          选择要切换的会话
        </h3>
      </div>
    </template>

    <div class="min-h-[400px] max-h-[60vh] overflow-auto">
      <!-- 加载状态 -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-12">
        <ProgressSpinner style="width: 32px; height: 32px" strokeWidth="3" />
        <p class="mt-4 text-surface-600 dark:text-surface-400">正在加载会话列表...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="py-8">
        <Message severity="error" :closable="false" class="mb-4">
          {{ error }}
        </Message>
        <div class="flex justify-center">
          <Button label="重试" icon="pi pi-refresh" @click="loadSessions" severity="secondary" />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="sessions.length === 0" class="flex flex-col items-center justify-center py-12">
        <i class="pi pi-inbox text-4xl text-surface-400 dark:text-surface-600 mb-3"></i>
        <p class="text-surface-600 dark:text-surface-400">没有可切换的会话</p>
      </div>

      <!-- 会话列表 -->
      <div v-else class="space-y-3">
        <div v-for="(session, index) in sessions" :key="session.session_id" ref="items" :class="[
          'p-4 border rounded-lg cursor-pointer transition-all duration-200 outline-none',
          selectedIndex === index
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400 shadow-sm'
            : 'border-surface-200 dark:border-surface-700 hover:border-primary-300 hover:bg-surface-50 dark:hover:bg-surface-800'
        ]" @click="selectSession(index)" @dblclick="confirmSelection" tabindex="0">
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-surface-900 dark:text-surface-0">
                {{ truncate(session.session_id, 20) }}
              </span>
              <span v-if="session.is_active"
                class="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                活跃
              </span>
              <span v-else
                class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400">
                已关闭
              </span>
            </div>
            <span class="text-sm text-surface-500 dark:text-surface-400">
              {{ formatTime(session.last_activity) }}
            </span>
          </div>

          <div v-if="session.last_user_input"
            class="text-sm text-surface-500 dark:text-surface-400 italic bg-surface-100 dark:bg-surface-800 p-3 rounded-md border-l-2 border-surface-300 dark:border-surface-600">
            {{ truncate(session.last_user_input, 80) }}
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="取消" @click="close" severity="secondary" :disabled="loading" />
        <Button label="切换" @click="confirmSelection" :disabled="selectedIndex === -1 || loading" :loading="loading" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, useTemplateRef } from 'vue'
import { useResume } from '../composables/useResume'
import type { UnifiedSessionInfo } from '../types/session'

const {
  isSessionListVisible,
  loadSessionList,
  resumeSession
} = useResume()

const visible = ref(false)
const sessions = ref<UnifiedSessionInfo[]>([])
const selectedIndex = ref(-1)
const loading = ref(false)
const error = ref<string | null>(null)
const itemRefs = useTemplateRef<HTMLElement[]>('items')
const showActiveOnly = ref(false)

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
    let allSessions = await loadSessionList()

    // 可选：根据过滤条件筛选
    if (showActiveOnly.value) {
      allSessions = allSessions.filter(s => s.is_active)
    }

    // 按最后活动时间倒序排列
    sessions.value = allSessions.sort((a, b) =>
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
    await resumeSession(session.session_id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '恢复会话失败'
  } finally {
    loading.value = false
  }
}

function close() {
  isSessionListVisible.value = false
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

// 当模态框显示时自动聚焦到对话框内容
watch(visible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      // PrimeVue Dialog 会自动处理焦点
      scrollToSelected()
    })
  }
})

</script>

<style scoped>
/* 确保对话框可以正确接收键盘事件 */
.session-selector-dialog {
  z-index: 1000;
}

/* 自定义对话框内部滚动条样式 */
.session-selector-dialog :deep(.p-dialog-content) {
  padding: 0;
}

/* 为可聚焦的会话项添加焦点样式 */
.session-selector-dialog :deep(.p-dialog-content [tabindex="0"]:focus) {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}
</style>