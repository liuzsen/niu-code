import { computed, ref, watch } from 'vue'
import { cleanToolResult } from '../utils/messageExtractors'
import { useChatManager } from '../stores/chat'
import type { ToolUseState } from '../types'

export function useToolUseHandler(toolId: string) {
  const chatManager = useChatManager()

  const pendingPermissionRequest = computed(() => chatManager.foregroundChat.pendingRequest)

  const toolResult = computed(() => {
    return chatManager.foregroundChat.toolResults.get(toolId)
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