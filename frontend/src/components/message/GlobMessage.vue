<template>
    <div>
        <!-- Glob Header -->
        <div class="p-2 border-b border-surface-200 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-file-search dark:text-surface-500"></i>
                    <span class="font-mono font-bold">Glob Search</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <!-- Status indicator -->
                    <div v-if="state == 'running'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Searching...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-check-circle text-green-500 text-sm"></i>
                        <span class="text-xs text-green-500">Completed</span>
                    </div>
                    <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Error</span>
                    </div>
                    <div v-else-if="state === 'rejected'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Rejected</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Glob Content -->
        <div class="p-2">
            <div>
                <!-- Search Parameters -->
                <div class="space-y-3 mb-4">
                    <!-- Pattern -->
                    <div class="flex items-center gap-2">
                        <span class="font-mono text-sm font-semibold">🔍</span>
                        <div class="text-xs text-caption-text">Pattern</div>
                        <code class="font-mono text-sm bg-code-inline-bg px-1 rounded-sm">{{ input.pattern }}</code>
                    </div>

                    <!-- Path -->
                    <div v-if="input.path" class="flex items-center gap-2">
                        <span class="font-mono text-sm font-semibold">📁</span>
                        <div class="text-xs text-caption-text ">Search Path</div>
                        <code
                            class="font-mono text-sm bg-code-inline-bg px-1 rounded-sm">{{ toRelativePath(input.path) }}</code>
                    </div>
                </div>

                <!-- Search Results -->
                <div v-if="globResult && resultContent">
                    <!-- Result Preview -->
                    <div class="relative bg-code-inline-bg rounded-lg p-3">
                        <!-- Action buttons - fixed position in top right corner -->
                        <div
                            class="absolute top-1 right-1 flex items-center gap-1 z-10 bg-surface-50 dark:bg-surface-900 rounded">
                            <Button size="small" severity="secondary" variant="text" @click="copyToClipboard"
                                class="w-6 h-6 p-0 hover:bg-surface-200 dark:hover:bg-surface-800 rounded"
                                v-tooltip.left="'Copy'">
                                <i class="pi pi-copy text-xs"></i>
                            </Button>
                            <Button v-if="showExpandButton" size="small" severity="secondary" variant="text"
                                @click="showFullContent = true"
                                class="w-6 h-6 p-0 hover:bg-surface-200 dark:hover:bg-surface-800 rounded"
                                v-tooltip.left="'View Full'">
                                <i class="pi pi-expand text-xs"></i>
                            </Button>
                        </div>
                        <div class="space-y-1">
                            <div v-for="(file, index) in limitedFileMatches" :key="index" class="font-mono text-sm">
                                <i class="pi pi-file text-xs mr-1"></i>
                                {{ toRelativePath(file) }}
                            </div>
                            <div v-if="hasMoreFiles" class="text-xs text-surface-500 dark:text-surface-400 italic">
                                ... {{ fileMatches.length - 10 }} more files
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Loading state -->
                <div v-else-if="state === 'running'"
                    class="bg-surface-50 dark:bg-surface-900 rounded-lg p-8 text-center">
                    <ProgressSpinner class="w-6 h-6 mx-auto mb-2" />
                    <div class="text-sm text-surface-500">Searching for files...</div>
                </div>

            </div>
        </div>
    </div>

    <!-- Full Content Modal -->
    <Dialog v-model:visible="showFullContent" modal class="w-[90vw] max-w-[1000px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i class="pi pi-file-search"></i>
                Glob Results: {{ input.pattern }}
            </div>
        </template>
        <div class="space-y-4">
            <div
                class="bg-surface-100 dark:bg-surface-900 rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar-dark border border-surface-300 dark:border-surface-700">
                <div class="space-y-1">
                    <div v-for="(file, index) in fileMatches" :key="index" class="font-mono text-sm py-1">
                        <i class="pi pi-file text-xs mr-1"></i>
                        {{ toRelativePath(file) }}
                    </div>
                </div>
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

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChatManager } from '../../stores/chat'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import type { GlobInput } from '../../types/sdk-tools'
import { toRelativePath } from '../../utils/pathProcess'
import type { ToolUseState } from '../../types/tool_use'

interface Props {
    id: string
    input: GlobInput
}

const props = defineProps<Props>()
const chatManager = useChatManager()
const showFullContent = ref(false)

// 获取工具结果
const globResult = computed(() => {
    return chatManager.foregroundChat.toolResults.get(props.id)
})

const state = computed<ToolUseState>(() => {
    if (globResult.value) {
        if (globResult.value.is_error) {
            return "error"
        } else {
            return "ok"
        }
    } else {
        return "running"
    }
})


// 解析结果内容
const resultContent = computed(() => {
    if (globResult.value && !globResult.value.is_error) {
        if (typeof globResult.value.content === "string") {
            return globResult.value.content.trim()
        }
    }
    return ''
})

// 解析文件匹配结果
const fileMatches = computed(() => {
    const content = resultContent.value
    if (!content) return []

    return content.split('\n')
        .filter(line => line.trim())
        .map(line => line.trim())
})

// 限制的文件匹配结果（最多10个）
const limitedFileMatches = computed(() => {
    return fileMatches.value.slice(0, 10)
})

// 是否有更多文件
const hasMoreFiles = computed(() => {
    return fileMatches.value.length > 10
})

// 是否显示展开按钮
const showExpandButton = computed(() => {
    return fileMatches.value.length > 10
})

// 复制到剪贴板
const copyToClipboard = async () => {
    try {
        const content = resultContent.value
        if (content) {
            await navigator.clipboard.writeText(content)
        }
    } catch (err) {
        console.error('Failed to copy text: ', err)
    }
}
</script>
