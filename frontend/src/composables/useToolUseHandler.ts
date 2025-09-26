import { computed, ref, watch } from 'vue'
import { cleanToolResult } from '../utils/messageExtractors'
import { useChatStore } from '../stores/chat'
import type { ToolUseState } from '../types'

export function useToolUseHandler(toolId: string) {
  const chatStore = useChatStore()

  const pendingPermissionRequest = computed(() => chatStore.pendingPermissionRequest)

  const toolResult = computed(() => {
    return chatStore.getToolResult(toolId)
  })

  const state = ref<ToolUseState>("running")

  watch(toolResult, () => {
    if (state.value == 'rejected') {
      return
    }
    if (toolResult.value) {
      if (toolResult.value.is_error) {
        state.value = "error"
      } else {
        state.value = "ok"
      }
    }
  }, {
    immediate: true
  })

  const resultText = computed(() => {
    if (toolResult.value) {
      return cleanToolResult(toolResult.value.content)
    }
    return undefined
  })

  return {
    pendingPermissionRequest,
    toolResult,
    state,
    resultText
  }
}