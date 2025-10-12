<template>
    <div>
        <!-- WebSearch Header -->
        <div class="p-2 border-b border-border-subtle">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-search dark:text-surface-500"></i>
                    <span class="font-mono font-bold">Web Search</span>
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

        <!-- WebSearch Content -->
        <div class="p-2">
            <div>
                <!-- Search Parameters -->
                <div class="space-y-3 mb-4">
                    <!-- Query -->
                    <div class="flex items-start gap-2">
                        <span class="font-mono text-sm font-semibold">🔍</span>
                        <div class="text-xs text-surface-600 dark:text-surface-500">Query</div>
                        <code class="font-mono text-sm bg-code-inline-bg px-1 rounded-sm">{{
                            input.query }}</code>
                    </div>

                    <!-- Allowed Domains -->
                    <div v-if="input.allowed_domains && input.allowed_domains.length > 0"
                        class="flex items-start gap-2">
                        <span class="font-mono text-sm font-semibold">✅</span>
                        <div class="text-xs text-surface-600 dark:text-surface-500">Allowed Domains</div>
                        <div class="flex flex-wrap gap-1">
                            <code v-for="(domain, idx) in input.allowed_domains" :key="idx"
                                class="font-mono text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1 rounded-sm">
                                {{ domain }}
                            </code>
                        </div>
                    </div>

                    <!-- Blocked Domains -->
                    <div v-if="input.blocked_domains && input.blocked_domains.length > 0"
                        class="flex items-start gap-2">
                        <span class="font-mono text-sm font-semibold">🚫</span>
                        <div class="text-xs text-surface-600 dark:text-surface-500">Blocked Domains</div>
                        <div class="flex flex-wrap gap-1">
                            <code v-for="(domain, idx) in input.blocked_domains" :key="idx"
                                class="font-mono text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-1 rounded-sm">
                                {{ domain }}
                            </code>
                        </div>
                    </div>
                </div>

                <!-- Search Results -->
                <div v-if="searchResults">
                    <!-- Results Preview -->
                    <div class="relative bg-code-block-bg rounded-lg p-3">
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
                        <div class="max-h-96 overflow-auto custom-scrollbar-light space-y-3 pr-10">
                            <div v-for="(result, idx) in limitedResults" :key="idx"
                                class="border-l-2 border-blue-500 pl-3">
                                <div class="space-y-1">
                                    <a v-if="result.url" :href="result.url" target="_blank" rel="noopener noreferrer"
                                        class="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-sm">
                                        {{ result.title || result.url }}
                                    </a>
                                    <div v-else class="font-semibold text-sm">{{ result.title || 'Result' }}</div>
                                    <div v-if="result.snippet"
                                        class="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
                                        {{ result.snippet }}
                                    </div>
                                    <div v-if="result.url" class="text-xs text-green-600 dark:text-green-400">
                                        {{ result.url }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-if="hasMoreResults" class="text-xs text-surface-500 dark:text-surface-400 italic mt-2">
                            ... {{ searchResults.length - 5 }} more results
                        </div>
                    </div>
                </div>

                <!-- Loading state -->
                <div v-else-if="state === 'running'"
                    class="bg-surface-50 dark:bg-surface-900 rounded-lg p-8 text-center">
                    <ProgressSpinner class="w-6 h-6 mx-auto mb-2" />
                    <div class="text-sm text-surface-500">Searching the web...</div>
                </div>

            </div>
        </div>
    </div>

    <!-- Full Content Modal -->
    <Dialog v-model:visible="showFullContent" modal class="w-[90vw] max-w-[1000px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i class="pi pi-search"></i>
                Search Results: {{ input.query }}
            </div>
        </template>
        <div class="space-y-4">
            <div
                class="bg-surface-100 dark:bg-surface-900 rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar-dark border border-surface-300 dark:border-surface-700 space-y-4">
                <div v-for="(result, idx) in searchResults" :key="idx" class="border-l-2 border-blue-500 pl-3">
                    <div class="space-y-1">
                        <a v-if="result.url" :href="result.url" target="_blank" rel="noopener noreferrer"
                            class="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                            {{ result.title || result.url }}
                        </a>
                        <div v-else class="font-semibold">{{ result.title || 'Result' }}</div>
                        <div v-if="result.snippet" class="text-surface-700 dark:text-surface-300 leading-relaxed">
                            {{ result.snippet }}
                        </div>
                        <div v-if="result.url" class="text-sm text-green-600 dark:text-green-400">
                            {{ result.url }}
                        </div>
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
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import type { WebSearchInput } from '../../types/sdk-tools'
import { useToolUseHandler } from '../../composables/useToolUseHandler'

interface Props {
    id: string
    input: WebSearchInput
}

interface SearchResult {
    title?: string
    url?: string
    snippet?: string
}

const props = defineProps<Props>()
const { state, resultText } = useToolUseHandler(props.id)

const showFullContent = ref(false)

// Parse search results from the result text
const searchResults = computed<SearchResult[] | null>(() => {
    const text = resultText.value
    if (!text) return null

    // Try to parse as JSON array first
    try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
            return parsed
        }
    } catch {
        // Not JSON, parse as text
    }

    // Parse text format results
    // Expected format: title, URL, and snippet separated by newlines or other delimiters
    const results: SearchResult[] = []
    const lines = text.split('\n\n') // Split by double newline for result blocks

    for (const block of lines) {
        if (!block.trim()) continue

        const result: SearchResult = {}
        const blockLines = block.split('\n')

        // Simple heuristic: first line is title, lines with http are URLs, rest is snippet
        for (const line of blockLines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                result.url = trimmed
            } else if (!result.title) {
                result.title = trimmed
            } else {
                result.snippet = (result.snippet || '') + (result.snippet ? ' ' : '') + trimmed
            }
        }

        if (result.title || result.url || result.snippet) {
            results.push(result)
        }
    }

    return results.length > 0 ? results : [{ snippet: text }]
})

// Limited results (max 5 for preview)
const limitedResults = computed(() => {
    return searchResults.value?.slice(0, 5) || []
})

// Check if there are more results
const hasMoreResults = computed(() => {
    return (searchResults.value?.length || 0) > 5
})

// Show expand button if there are more than 5 results
const showExpandButton = computed(() => {
    return hasMoreResults.value
})

// Copy to clipboard (copy all results as formatted text)
const copyToClipboard = async () => {
    try {
        if (searchResults.value) {
            const formatted = searchResults.value.map((result, idx) => {
                const parts = []
                parts.push(`Result ${idx + 1}:`)
                if (result.title) parts.push(`Title: ${result.title}`)
                if (result.url) parts.push(`URL: ${result.url}`)
                if (result.snippet) parts.push(`Snippet: ${result.snippet}`)
                return parts.join('\n')
            }).join('\n\n')

            await navigator.clipboard.writeText(formatted)
        } else if (resultText.value) {
            await navigator.clipboard.writeText(resultText.value)
        }
    } catch (err) {
        console.error('Failed to copy text: ', err)
    }
}
</script>
