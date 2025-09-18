<template>
  <div class="min-h-0">
    <!-- Modern Chat Input Container -->
    <div class="bg-surface-0 border border-surface-200 rounded-2xl p-3 shadow-sm">
      <!-- Input Area -->
      <div class="mb-1">
        <Textarea v-model="messageInput" ref="textareaRef" placeholder="在这里输入消息，按 Enter 发送..."
          class="w-full resize-none border-0 outline-none bg-transparent text-surface-700 placeholder:text-surface-400 min-h-8 max-h-32"
          :disabled="disabled" :auto-resize="true" @keydown.enter.prevent="handleKeydown" />
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between">
        <!-- Left Tool Buttons -->
        <div class="flex items-center gap-2">
          <Button icon="pi pi-paperclip" severity="secondary" variant="text" size="small"
            class="!p-1 !w-7 !h-7 text-surface-500 hover:text-surface-700" />
          <Button icon="pi pi-face-smile" severity="secondary" variant="text" size="small"
            class="!p-1 !w-7 !h-7 text-surface-500 hover:text-surface-700" />
          <Button icon="pi pi-at" severity="secondary" variant="text" size="small"
            class="!p-1 !w-7 !h-7 text-surface-500 hover:text-surface-700" />
          <Button icon="pi pi-image" severity="secondary" variant="text" size="small"
            class="!p-1 !w-7 !h-7 text-surface-500 hover:text-surface-700" />
          <Button icon="pi pi-bolt" severity="secondary" variant="text" size="small"
            class="!p-1 !w-7 !h-7 text-surface-500 hover:text-surface-700" />
          <Button icon="pi pi-th-large" severity="secondary" variant="text" size="small"
            class="!p-1 !w-7 !h-7 text-surface-500 hover:text-surface-700" />

          <!-- Language/Settings Button -->
          <Button icon="pi pi-language" severity="secondary" variant="text" size="small"
            class="!p-1 !w-7 !h-7 text-surface-500 hover:text-surface-700" />
        </div>

        <!-- Right Side Buttons -->
        <div class="flex items-center gap-2">

          <!-- Send Button -->
          <Button @click="sendUserInput" :disabled="disabled || !messageInput.trim()" icon="pi pi-arrow-up"
            severity="info" size="small" class="!rounded-full !w-8 !h-8 !p-0 shrink-0" />
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mt-2 text-sm text-red-500">
      <i class="pi pi-exclamation-triangle mr-1"></i>
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { wsService } from '../services/websocket'

interface Props {
  disabled: boolean
  error?: string
}

defineProps<Props>()

const messageInput = ref('')
const textareaRef = ref()

const sendUserInput = () => {
  if (!messageInput.value.trim()) return
  wsService.sendUserInput(messageInput.value.trim())
  messageInput.value = ''
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.shiftKey) {
    // Insert newline when Shift+Enter is pressed
    e.preventDefault()
    messageInput.value += '\n'
    console.log("new line")
  } else {
    // Send message when Enter is pressed without Shift
    sendUserInput()
  }
}

// Auto-scroll to bottom when content changes
watch(messageInput, async () => {
  await nextTick()
  if (textareaRef.value?.$el) {
    const textarea = textareaRef.value.$el
    textarea.scrollTop = textarea.scrollHeight
  }
})
</script>