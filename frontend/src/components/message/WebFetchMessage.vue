<template>
    <div>
        <!-- WebFetch Header -->
        <div class="p-2 border-b border-surface-200 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-globe dark:text-surface-500"></i>
                    <span class="font-mono font-bold">Web Fetch</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <!-- Status indicator -->
                    <div v-if="state == 'running'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Fetching...</span>
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

        <!-- WebFetch Content -->
        <div class="p-2">
            <div>
                <!-- Request Parameters -->
                <div class="space-y-3 mb-4">
                    <!-- URL -->
                    <div class="flex items-center gap-2">
                        <span class="font-mono text-sm font-semibold">🔗</span>
                        <div class="text-xs text-surface-600 dark:text-surface-500">URL</div>
                        <a :href="input.url" target="_blank" rel="noopener noreferrer"
                            class="font-mono text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 break-all">
                            {{ input.url }}
                        </a>
                    </div>

                    <!-- Prompt -->
                    <div class="flex items-center gap-2">
                        <span class="font-mono text-sm font-semibold">💬</span>
                        <div class="text-xs text-surface-600 dark:text-surface-500">Prompt</div>
                        <code class="font-mono text-sm bg-surface-400 dark:bg-surface-800 px-1 rounded-sm break-all">{{
                            input.prompt }}</code>
                    </div>
                </div>

                <!-- Fetched Content -->
                <div v-if="resultText">
                    <!-- Content Preview -->
                    <div class="relative bg-surface-50 dark:bg-surface-900 rounded-lg p-3">
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

                        <!-- Limited preview -->
                        <div class="max-h-64 overflow-auto custom-scrollbar-light">
                            <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ previewText }}</pre>
                        </div>
                        <div v-if="showExpandButton" class="text-xs text-surface-500 dark:text-surface-400 italic mt-2">
                            ... content truncated
                        </div>
                    </div>
                </div>

                <!-- Loading state -->
                <div v-else-if="state === 'running'"
                    class="bg-surface-50 dark:bg-surface-900 rounded-lg p-8 text-center">
                    <ProgressSpinner class="w-6 h-6 mx-auto mb-2" />
                    <div class="text-sm text-surface-500">Fetching content from URL...</div>
                </div>

            </div>
        </div>
    </div>

    <!-- Full Content Modal -->
    <Dialog v-model:visible="showFullContent" modal class="w-[90vw] max-w-[1000px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i class="pi pi-globe"></i>
                Fetched Content
            </div>
        </template>
        <div class="space-y-4">
            <div
                class="bg-surface-100 dark:bg-surface-900 rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar-dark border border-surface-300 dark:border-surface-700">
                <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ resultText }}</pre>
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
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import type { WebFetchInput } from '../../types/sdk-tools'
import { useToolUseHandler } from '../../composables/useToolUseHandler'

interface Props {
    id: string
    input: WebFetchInput
}

const props = defineProps<Props>()
const { state, resultText } = useToolUseHandler(props.id)

const showFullContent = ref(false)

// Preview text (limited to ~1000 characters)
const previewText = computed(() => {
    const text = resultText.value
    if (!text) return ''
    if (text.length <= 1000) return text
    return text.substring(0, 1000)
})

// Show expand button if content is long
const showExpandButton = computed(() => {
    const text = resultText.value
    return text && text.length > 1000
})

// Copy to clipboard
const copyToClipboard = async () => {
    try {
        const content = resultText.value
        if (content) {
            await navigator.clipboard.writeText(content)
        }
    } catch (err) {
        console.error('Failed to copy text: ', err)
    }
}
</script>
