<template>
  <div class="min-h-0">
    <div class="flex items-end space-x-3">
      <Textarea v-model="messageInput" ref="textareaRef" placeholder="Type your message..."
        class="w-full p-2 border rounded min-h-12" :disabled="disabled"
        @keydown.enter.prevent="handleKeydown"></Textarea>
      <Button @click="sendUserInput" :disabled="disabled || !messageInput.trim()" icon="pi pi-send" severity="info" />
    </div>

    <div v-if="error" class="mt-2 text-sm" style="color: var(--red-500)">
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