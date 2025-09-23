<template>
    <div
        class="bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 shadow-lg rounded-xl">
        <!-- Edit Header -->
        <div class="p-4 border-b border-surface-300 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-file-edit dark:text-surface-500"></i>
                    <span class="text-sm font-mono">File Edit</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <!-- Status indicator -->
                    <div v-if="state == 'pending'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Editing...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-check-circle text-green-500 text-sm"></i>
                        <span class="text-xs text-green-500">Edited</span>
                    </div>
                    <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Error</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Edit Content -->
        <div class="p-4">
            <div class="space-y-4">
                <!-- File Path -->
                <div class="flex items-start gap-2">
                    <span class="font-mono text-sm font-semibold">📁</span>
                    <code class="font-mono text-sm leading-relaxed break-all">{{ data.file_path }}</code>
                </div>

                <!-- Changes Summary -->
                <div class="space-y-3">
                    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <div class="text-xs text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                            <i class="pi pi-minus"></i>
                            Old Content ({{ oldStringLength }} chars)
                        </div>
                        <div class="max-h-32 overflow-y-auto custom-scrollbar">
                            <pre
                                class="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">{{ data.old_string }}</pre>
                        </div>
                    </div>
                    <div
                        class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <div class="text-xs text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                            <i class="pi pi-plus"></i>
                            New Content ({{ newStringLength }} chars)
                        </div>
                        <div class="max-h-32 overflow-y-auto custom-scrollbar">
                            <pre
                                class="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">{{ data.new_string }}</pre>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <Button size="small" severity="secondary" variant="text" @click="copyOldString">
                            <i class="pi pi-copy text-sm"></i>
                            Copy Old
                        </Button>
                        <Button size="small" severity="secondary" variant="text" @click="copyNewString">
                            <i class="pi pi-copy text-sm"></i>
                            Copy New
                        </Button>
                        <Button size="small" severity="secondary" variant="text" @click="showFullDiff = true">
                            <i class="pi pi-expand text-xs"></i>
                            View Full
                        </Button>
                    </div>
                </div>

                <!-- Result/Error -->
                <div v-if="resultText" class="border-t border-surface-300 dark:border-surface-700 pt-3">
                    <div class="text-xs mb-2">Result:</div>
                    <div class="bg-surface-50 dark:bg-surface-900 rounded-lg p-3">
                        <pre
                            class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Full Diff Modal -->
    <Dialog v-model:visible="showFullDiff" modal class="w-[90vw] max-w-[1200px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i class="pi pi-file-edit"></i>
                {{ data.file_path }}
            </div>
        </template>
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">Old Content</div>
                    <div
                        class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                        <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ data.old_string }}</pre>
                    </div>
                </div>
                <div>
                    <div class="text-sm font-semibold mb-2 text-green-600 dark:text-green-400">New Content</div>
                    <div
                        class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                        <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ data.new_string }}</pre>
                    </div>
                </div>
            </div>
            <div class="flex justify-end gap-2">
                <Button severity="secondary" @click="copyOldString" size="small">
                    <i class="pi pi-copy mr-1"></i>
                    Copy Old
                </Button>
                <Button severity="secondary" @click="copyNewString" size="small">
                    <i class="pi pi-copy mr-1"></i>
                    Copy New
                </Button>
                <Button severity="secondary" @click="showFullDiff = false" size="small">
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
import type { EditData } from '../../utils/messageExtractors'
import { cleanToolResult } from '../../utils/messageExtractors'
import { useChatStore } from '../../stores/chat'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import type { SDKMessage } from '@anthropic-ai/claude-code'

interface Props {
    message: SDKMessage
    data: EditData
}

const props = defineProps<Props>()
const chatStore = useChatStore()
const showFullDiff = ref(false)

// 获取命令执行结果
const editResult = computed(() => {
    return chatStore.getToolResult(props.data.id)
})

type EditState = "pending" | "error" | "ok"

const state = computed<EditState>(() => {
    if (editResult.value) {
        if (editResult.value.is_error) {
            return "error"
        } else {
            return "ok"
        }
    } else {
        return "pending"
    }
})

// 字符串长度
const oldStringLength = computed(() => {
    return props.data.old_string.length
})

const newStringLength = computed(() => {
    return props.data.new_string.length
})

// 复制到剪贴板
const copyOldString = async () => {
    try {
        await navigator.clipboard.writeText(props.data.old_string)
    } catch (err) {
        console.error('Failed to copy old string: ', err)
    }
}

const copyNewString = async () => {
    try {
        await navigator.clipboard.writeText(props.data.new_string)
    } catch (err) {
        console.error('Failed to copy new string: ', err)
    }
}

// 显示结果文本
const resultText = computed(() => {
    if (editResult.value) {
        return cleanToolResult(editResult.value.content)
    }
    return undefined
})
</script>