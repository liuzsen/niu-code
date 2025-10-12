<template>
    <div>
        <!-- Grep Header -->
        <div class="p-2 border-b border-surface-200 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-search dark:text-surface-500"></i>
                    <span class="font-mono font-bold text-heading-text">Grep Search</span>
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

        <!-- Grep Content -->
        <div class="p-2">
            <div>
                <!-- Search Parameters -->
                <div class="space-y-3 mb-4">
                    <!-- Pattern -->
                    <div class="flex items-center gap-2">
                        <span class="font-mono text-sm font-semibold">🔍</span>
                        <div class="text-xs text-caption-text ">Pattern</div>
                        <code class="font-mono text-sm bg-code-inline-bg px-1 rounded-sm">{{ input.pattern }}</code>
                    </div>

                    <!-- Path -->
                    <div v-if="input.path" class="flex items-center gap-2">
                        <span class="font-mono text-sm font-semibold">📁</span>
                        <div class="text-xs text-caption-text">Search Path</div>
                        <code
                            class="font-mono text-sm bg-code-inline-bg px-1 rounded-sm">{{ toRelativePath(input.path) }}</code>
                    </div>
                </div>

                <!-- Search Results -->
                <div v-if="grepResult && resultContent">
                    <!-- Result Preview -->
                    <div class="relative bg-code-block-bg rounded-lg p-3">
                        <!-- Action buttons - fixed position in top right corner -->
                        <div class="absolute top-1 right-1 flex items-center gap-1 z-10 rounded">
                            <Button size="small" variant="text" @click="copyToClipboard"
                                class="w-6 h-6 p-0 bg-button-ghost-bg text-button-ghost-text rounded">
                                <i class="pi pi-copy text-xs"></i>
                            </Button>
                            <Button v-if="showExpandButton" size="small" variant="text" @click="showFullContent = true"
                                class="w-6 h-6 p-0 bg-button-ghost-bg text-button-ghost-text rounded">
                                <i class="pi pi-expand text-xs"></i>
                            </Button>
                        </div>
                        <div v-if="input.output_mode === 'content'" class="space-y-2">
                            <div v-for="(match, index) in limitedContentMatches" :key="index"
                                class="border-l-2 border-blue-500 pl-2">
                                <div class="flex items-start gap-2">
                                    <span class="text-xs text-surface-500 dark:text-surface-400 font-mono min-w-16">{{
                                        match.lineNumber }}</span>
                                    <pre
                                        class="font-mono text-sm leading-relaxed whitespace-pre-wrap flex-1">{{ match.content }}</pre>
                                </div>
                            </div>
                            <div v-if="hasMoreContent" class="text-xs text-surface-500 dark:text-surface-400 italic">
                                ... {{ contentMatches.length - 10 }} more lines
                            </div>
                        </div>
                        <div v-else-if="input.output_mode === 'files_with_matches'" class="space-y-1">
                            <div v-for="(file, index) in limitedFileMatches" :key="index" class="font-mono text-sm">
                                <i class="pi pi-file text-xs mr-1"></i>
                                {{ toRelativePath(file) }}
                            </div>
                            <div v-if="hasMoreFiles" class="text-xs text-surface-500 dark:text-surface-400 italic">
                                ... {{ fileMatches.length - 10 }} more files
                            </div>
                        </div>
                        <div v-else-if="input.output_mode === 'count'" class="space-y-1">
                            <div v-for="(count, file) in limitedCountMatches" :key="file"
                                class="flex justify-between font-mono text-sm">
                                <span>{{ toRelativePath(String(file)) }}</span>
                                <span class="text-surface-600 dark:text-surface-400">{{ count }} matches</span>
                            </div>
                            <div v-if="hasMoreCounts" class="text-xs text-surface-500 dark:text-surface-400 italic">
                                ... {{ Object.keys(countMatches).length - 10 }} more files
                            </div>
                        </div>
                        <div v-else class="font-mono text-sm">
                            <!-- Default to files_with_matches mode -->
                            <div v-for="(file, index) in limitedDefaultFileMatches" :key="index"
                                class="font-mono text-sm">
                                <i class="pi pi-file text-xs mr-1"></i>
                                {{ toRelativePath(file) }}
                            </div>
                            <div v-if="hasMoreDefaultFiles"
                                class="text-xs text-surface-500 dark:text-surface-400 italic">
                                ... {{ defaultFileMatches.length - 10 }} more files
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Loading state -->
                <div v-else-if="state === 'running'"
                    class="bg-surface-50 dark:bg-surface-900 rounded-lg p-8 text-center">
                    <ProgressSpinner class="w-6 h-6 mx-auto mb-2" />
                    <div class="text-sm text-surface-500">Searching for matches...</div>
                </div>

            </div>
        </div>
    </div>

    <!-- Full Content Modal -->
    <Dialog v-model:visible="showFullContent" modal class="w-[90vw] max-w-[1000px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i class="pi pi-search"></i>
                Grep Results: {{ input.pattern }}
            </div>
        </template>
        <div class="space-y-4">
            <div
                class="bg-surface-100 dark:bg-surface-900 rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar border border-surface-300 dark:border-surface-700">
                <div v-if="input.output_mode === 'content'" class="space-y-2">
                    <div v-for="(match, index) in contentMatches" :key="index" class="border-l-2 border-blue-500 pl-2">
                        <div class="flex items-start gap-2">
                            <span class="text-xs text-surface-500 dark:text-surface-400 font-mono min-w-16">{{
                                match.lineNumber
                                }}</span>
                            <pre
                                class="font-mono text-sm leading-relaxed whitespace-pre-wrap flex-1">{{ match.content }}</pre>
                        </div>
                    </div>
                </div>
                <div v-else-if="input.output_mode === 'files_with_matches'" class="space-y-1">
                    <div v-for="(file, index) in fileMatches" :key="index" class="font-mono text-sm py-1">
                        <i class="pi pi-file text-xs mr-1"></i>
                        {{ toRelativePath(file) }}
                    </div>
                </div>
                <div v-else-if="input.output_mode === 'count'" class="space-y-1">
                    <div v-for="(count, file) in countMatches" :key="file"
                        class="flex justify-between font-mono text-sm py-1">
                        <span>{{ toRelativePath(file) }}</span>
                        <span class="text-surface-600 dark:text-surface-400">{{ count }} matches</span>
                    </div>
                </div>
                <div v-else class="font-mono text-sm">
                    <div v-for="(file, index) in defaultFileMatches" :key="index" class="font-mono text-sm py-1">
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
import type { GrepInput } from '../../types/sdk-tools'
import { toRelativePath } from '../../utils/pathProcess'
import type { ToolUseState } from '../../types/tool_use'

interface Props {
    id: string
    input: GrepInput
}

const props = defineProps<Props>()
const chatManager = useChatManager()
const showFullContent = ref(false)

// 获取工具结果
const grepResult = computed(() => {
    return chatManager.foregroundChat.toolResults.get(props.id)
})

const state = computed<ToolUseState>(() => {
    if (grepResult.value) {
        if (grepResult.value.is_error) {
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
    if (grepResult.value && !grepResult.value.is_error) {
        if (typeof grepResult.value.content === "string") {
            return grepResult.value.content.trim()
        }
    }
    return ''
})

// 解析内容匹配结果
const contentMatches = computed(() => {
    const content = resultContent.value
    if (!content || props.input.output_mode !== 'content') return []

    return content.split('\n')
        .filter(line => line.trim())
        .map(line => {
            // 解析行号和内容 (格式如 "filename:line:content" 或 "line:content")
            const match = line.match(/^(.+?):(\d+):(.*)$/)
            if (match) {
                return {
                    file: match[1],
                    lineNumber: match[2],
                    content: match[3]
                }
            }
            // 如果没有行号，尝试其他格式
            const lineOnlyMatch = line.match(/^(\d+):(.*)$/)
            if (lineOnlyMatch) {
                return {
                    file: '',
                    lineNumber: lineOnlyMatch[1],
                    content: lineOnlyMatch[2]
                }
            }
            return {
                file: '',
                lineNumber: '',
                content: line
            }
        })
})

// 限制的内容匹配结果（最多10行）
const limitedContentMatches = computed(() => {
    return contentMatches.value.slice(0, 10)
})

// 是否有更多内容
const hasMoreContent = computed(() => {
    return contentMatches.value.length > 10
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

// 解析计数匹配结果
const countMatches = computed(() => {
    const content = resultContent.value
    if (!content || props.input.output_mode !== 'count') return {}

    const counts: Record<string, number> = {}
    content.split('\n')
        .filter(line => line.trim())
        .forEach(line => {
            // 解析格式如 "filename:count"
            const match = line.match(/^(.+?):(\d+)$/)
            if (match) {
                counts[match[1]] = parseInt(match[2])
            }
        })

    return counts
})

// 限制的计数匹配结果（最多10个）
const limitedCountMatches = computed(() => {
    const entries = Object.entries(countMatches.value)
    return Object.fromEntries(entries.slice(0, 10))
})

// 是否有更多计数
const hasMoreCounts = computed(() => {
    return Object.keys(countMatches.value).length > 10
})

// 默认文件匹配（当没有指定output_mode时）
const defaultFileMatches = computed(() => {
    return fileMatches.value
})

// 限制的默认文件匹配结果（最多10个）
const limitedDefaultFileMatches = computed(() => {
    return defaultFileMatches.value.slice(0, 10)
})

// 是否有更多默认文件
const hasMoreDefaultFiles = computed(() => {
    return defaultFileMatches.value.length > 10
})

// 是否显示展开按钮
const showExpandButton = computed(() => {
    const content = resultContent.value
    if (!content) return false

    const lines = content.split('\n')
    return lines.length > 10 // 如果超过10行则显示展开按钮
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