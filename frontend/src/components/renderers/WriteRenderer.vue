<template>
    <Card class="bg-zinc-800">
        <!-- Write Header -->
        <template #title>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-file text-blue-500"></i>
                    <span class="text-sm font-mono text-gray-300">File Write</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <!-- Status indicator -->
                    <div v-if="state == 'pending'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Writing...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-check-circle text-green-500 text-sm"></i>
                        <span class="text-xs text-green-500">Written</span>
                    </div>
                    <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Error</span>
                    </div>
                </div>
            </div>
        </template>

        <!-- Write Content -->
        <template #content>
            <div class="space-y-3">
                <!-- File Path -->
                <div class="flex items-start gap-2">
                    <span class="text-blue-500 font-mono text-sm font-semibold">📝</span>
                    <code class="text-blue-500 font-mono text-sm leading-relaxed break-all">{{ data.file_path }}</code>
                </div>

                <!-- File Content (preview) -->
                <div class="mt-3">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-gray-400 text-xs">Content ({{ contentLength }} chars):</div>
                        <div class="flex items-center gap-2">
                            <Button size="small" severity="secondary" variant="text" @click="copyToClipboard">
                                <i class="pi pi-copy mr-1"></i>
                                Copy
                            </Button>
                            <Button size="small" severity="secondary" variant="text" @click="showFullContent = true">
                                <i class="pi pi-expand mr-1"></i>
                                View Full
                            </Button>
                        </div>
                    </div>
                    <div class="bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto custom-scrollbar">
                        <pre
                            class="text-gray-300 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ data.content }}</pre>
                    </div>
                </div>

                <!-- Result/Error -->
                <div v-if="resultText" class="mt-3">
                    <div class="text-gray-400 text-xs mb-1">Result:</div>
                    <div class="flex items-start gap-2">
                        <pre
                            class="text-gray-300 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
                    </div>
                </div>
            </div>
        </template>
    </Card>

    <!-- Full Content Modal -->
    <Dialog v-model:visible="showFullContent" modal :header="`File: ${data.file_path}`"
        :style="{ width: '90vw', maxWidth: '1000px' }" :dismissableMask="true">
        <div class="space-y-4">
            <div class="bg-gray-900 rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <pre
                    class="text-gray-300 font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ data.content }}</pre>
            </div>
            <div class="flex justify-end gap-2">
                <Button severity="secondary" @click="copyToClipboard" size="small">
                    <i class="pi pi-copy mr-1"></i>
                    Copy
                </Button>
                <Button severity="primary" @click="showFullContent = false" size="small">
                    Close
                </Button>
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
/* Custom scrollbar styling for this component only */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #374151 transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
  border: none;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 3px;
  border: none;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #4b5563;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ProjectClaudeMessage } from '../../types/claude'
import type { WriteData } from '../../utils/messageExtractors'
import { useChatStore } from '../../stores/chat'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

interface Props {
    message: ProjectClaudeMessage
    data: WriteData
}

const props = defineProps<Props>()
const chatStore = useChatStore()
const showFullContent = ref(false)

// 获取命令执行结果
const writeResult = computed(() => {
    return chatStore.getToolResult(props.data.id)
})

type WriteState = "pending" | "error" | "ok"

const state = computed<WriteState>(() => {
    if (writeResult.value) {
        if (writeResult.value.is_error) {
            return "error"
        } else {
            return "ok"
        }
    } else {
        return "pending"
    }
})

// 内容长度
const contentLength = computed(() => {
    return props.data.content.length
})

// 复制到剪贴板
const copyToClipboard = async () => {
    try {
        await navigator.clipboard.writeText(props.data.content)
    } catch (err) {
        console.error('Failed to copy text: ', err)
    }
}

// 显示结果文本
const resultText = computed(() => {
    if (writeResult.value) {
        if (typeof writeResult.value.content == "string") {
            return writeResult.value.content
        } else {
            return `unknown write result: ${writeResult.value.content}`
        }
    }
    return undefined
})
</script>