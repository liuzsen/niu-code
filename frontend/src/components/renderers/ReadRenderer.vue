<template>
    <div
        class="bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 shadow-lg rounded-xl">
        <!-- Read Header -->
        <div class="p-4 border-b border-surface-300 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-file-import dark:text-surface-500"></i>
                    <span class="text-sm font-mono">File Read</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <!-- Status indicator -->
                    <div v-if="state == 'pending'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Reading...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-check-circle text-green-500 text-sm"></i>
                        <span class="text-xs text-green-500">Read</span>
                    </div>
                    <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Error</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Read Content -->
        <div class="p-4">
            <div class="space-y-4">
                <!-- File Path -->
                <div class="flex items-start gap-2">
                    <span class="font-mono text-sm font-semibold">📖</span>
                    <code class="font-mono text-sm leading-relaxed break-all">{{ data.file_path }}</code>
                </div>

                <!-- File Content (preview) -->
                <div v-if="fileContent">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-surface-500 text-xs">File Content ({{ contentLength }} chars, {{ lineCount }}
                            lines):</div>
                        <div class="flex items-center gap-2">
                            <Button size="small" severity="secondary" variant="text" @click="copyToClipboard">
                                <i class="pi pi-copy text-sm"></i>
                                Copy
                            </Button>
                            <Button size="small" severity="secondary" variant="text" @click="showFullContent = true">
                                <i class="pi pi-expand text-xs"></i>
                                View Full
                            </Button>
                        </div>
                    </div>
                    <div
                        class="bg-surface-200 dark:bg-surface-900 p-3 max-h-40 overflow-y-auto custom-scrollbar rounded-lg">
                        <pre
                            class="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">{{ fileContent }}</pre>
                    </div>
                </div>

                <!-- Loading state -->
                <div v-else-if="state === 'pending'"
                    class="bg-surface-50 dark:bg-surface-900 rounded-lg p-8 text-center">
                    <ProgressSpinner class="w-6 h-6 mx-auto mb-2" />
                    <div class="text-sm text-surface-500">Reading file content...</div>
                </div>

            </div>
        </div>
    </div>

    <!-- Full Content Modal -->
    <Dialog v-model:visible="showFullContent" modal class="w-[90vw] max-w-[1000px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i class="pi pi-file-import"></i>
                {{ data.file_path }}
            </div>
        </template>
        <div class="space-y-4">
            <div
                class="bg-surface-100 dark:bg-surface-900 rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar border border-surface-300 dark:border-surface-700">
                <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ fileContent }}</pre>
            </div>
            <div class="flex justify-end gap-2">
                <Button severity="secondary" @click="copyToClipboard" size="small">
                    <i class="pi pi-copy mr-1"></i>
                    Copy
                </Button>
                <Button severity="secondary" @click="showFullContent = false" size="small">
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
import type { ReadData } from '../../utils/messageExtractors'
import { useChatStore } from '../../stores/chat'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

interface Props {
    message: ProjectClaudeMessage
    data: ReadData
}

const props = defineProps<Props>()
const chatStore = useChatStore()
const showFullContent = ref(false)

// 获取工具结果
const readResult = computed(() => {
    return chatStore.getToolResult(props.data.id)
})

type ReadState = "pending" | "error" | "ok"

const state = computed<ReadState>(() => {
    if (readResult.value) {
        if (readResult.value.is_error) {
            return "error"
        } else {
            return "ok"
        }
    } else {
        return "pending"
    }
})

// 文件内容
const fileContent = computed(() => {
    if (readResult.value && !readResult.value.is_error) {
        if (typeof readResult.value.content == "string") {
            // 移除行号前缀和 <system-reminder> 标签
            return cleanFileContent(readResult.value.content)
        }
    }
    return undefined
})

// 清理文件内容：移除行号前缀和 system-reminder 标签
const cleanFileContent = (content: string): string => {
    return content
        .split('\n')
        .map(line => {
            // 移除行号前缀 (格式如 "     1→", "    10→" 等)
            return line.replace(/^\s*\d+→/, '')
        })
        .filter(line => {
            // 只过滤掉 system-reminder 相关内容，保留空行
            if (line.includes('<system-reminder>')) return false
            if (line.includes('</system-reminder>')) return false
            if (line.trim().startsWith('Whenever you read a file')) return false
            return true
        })
        .join('\n')
}

// 内容长度
const contentLength = computed(() => {
    return fileContent.value?.length || 0
})

// 行数
const lineCount = computed(() => {
    return fileContent.value?.split('\n').length || 0
})

// 复制到剪贴板
const copyToClipboard = async () => {
    try {
        if (fileContent.value) {
            await navigator.clipboard.writeText(fileContent.value)
        }
    } catch (err) {
        console.error('Failed to copy text: ', err)
    }
}

</script>