<template>
    <div>
        <!-- WebSearch Header -->
        <div class="p-2 border-b border-surface-200 dark:border-surface-700">
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
                <div v-if="resultText" class="space-y-3">
                    <!-- Links Section -->
                    <div v-if="searchLinks && searchLinks.length > 0">
                        <div class="flex items-center gap-2 mb-2">
                            <i class="pi pi-link text-sm"></i>
                            <span class="text-xs font-semibold">Search Links ({{
                                searchLinks.length }})</span>
                        </div>
                        <div class="space-y-2">
                            <a v-for="(link, idx) in limitedLinks" :key="idx" :href="link.url" target="_blank"
                                rel="noopener noreferrer"
                                class="block text-body-text bg-code-block-bg rounded-lg p-2 transition-colors border border-border-subtle">
                                <div class="flex items-start gap-2">
                                    <i class="pi pi-external-link text-xs text-blue-500 mt-1"></i>
                                    <div class="flex-1 min-w-0">
                                        <div class="font-semibold text-sm truncate">
                                            {{ link.title }}
                                        </div>
                                        <div class="text-xs text-green-600 dark:text-green-400 truncate mt-0.5">
                                            {{ link.url }}
                                        </div>
                                    </div>
                                </div>
                            </a>
                        </div>
                        <Button v-if="hasMoreLinks" size="small" variant="text" @click="showAllLinks = true"
                            class="mt-2 text-xs text-blue-600 dark:text-blue-400">
                            <i class="pi pi-chevron-down mr-1"></i>
                            Show {{ searchLinks.length - 5 }} more links
                        </Button>
                    </div>

                    <!-- Formatted Response Section -->
                    <div v-if="formattedResponse">
                        <div class="flex items-center gap-2 mb-2">
                            <i class="pi pi-file-edit text-sm text-surface-600 dark:text-surface-500"></i>
                            <span class="text-xs font-semibold text-surface-600 dark:text-surface-500">Analysis</span>
                        </div>
                        <ContentPreview :content="formattedResponse" :maxLines="10" :icon="'pi pi-search'"
                            :label="input.query" />
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

    <!-- All Links Modal -->
    <Dialog v-model:visible="showAllLinks" modal class="w-[90vw] max-w-[1000px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i class="pi pi-link"></i>
                All Search Links: {{ input.query }}
            </div>
        </template>
        <div class="space-y-4">
            <div
                class="rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar border border-border-subtle space-y-2">
                <a v-for="(link, idx) in searchLinks" :key="idx" :href="link.url" target="_blank"
                    rel="noopener noreferrer"
                    class="block bg-code-block-bg hover:bg-hover-bg rounded-lg p-3 transition-colors">
                    <div class="flex items-start gap-2">
                        <i class="pi pi-external-link text-sm text-blue-500 mt-1"></i>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-body-text">
                                {{ link.title }}
                            </div>
                            <div class="text-sm text-green-600 dark:text-green-400 break-all mt-1">
                                {{ link.url }}
                            </div>
                        </div>
                    </div>
                </a>
            </div>
            <div class="flex justify-end gap-2">
                <Button severity="secondary" @click="showAllLinks = false" size="small">
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
import ContentPreview from '../common/ContentPreview.vue'
import type { WebSearchInput } from '../../types/sdk-tools'
import { useToolUseHandler } from '../../composables/useToolUseHandler'

interface Props {
    id: string
    input: WebSearchInput
}

interface SearchLink {
    title: string
    url: string
}

const props = defineProps<Props>()
const { state, resultText } = useToolUseHandler(props.id)

const showAllLinks = ref(false)

// Parse search links from the result text
const searchLinks = computed<SearchLink[] | null>(() => {
    const text = resultText.value
    if (!text) return null

    // Look for the Links: [...] section using simpler pattern
    const linksStartIndex = text.indexOf('Links: [')
    if (linksStartIndex === -1) return null

    // Find the end of the JSON array by finding the matching closing bracket
    let jsonStart = linksStartIndex + 7 // length of "Links: "
    let bracketCount = 0
    let jsonEnd = -1

    for (let i = jsonStart; i < text.length; i++) {
        if (text[i] === '[') bracketCount++
        if (text[i] === ']') {
            bracketCount--
            if (bracketCount === 0) {
                jsonEnd = i + 1
                break
            }
        }
    }

    if (jsonEnd === -1) return null

    try {
        const jsonStr = text.substring(jsonStart, jsonEnd)
        const linksArray = JSON.parse(jsonStr) as unknown[]
        if (Array.isArray(linksArray)) {
            return linksArray
                .filter((link): link is { title?: string; url?: string } =>
                    typeof link === 'object' && link !== null
                )
                .map((link) => ({
                    title: link.title || link.url || 'Untitled',
                    url: link.url || ''
                }))
                .filter(link => link.url)
        }
    } catch (err) {
        console.error('Failed to parse links JSON:', err)
    }

    return null
})

// Limited links (max 5 for preview)
const limitedLinks = computed(() => {
    return searchLinks.value?.slice(0, 5) || []
})

// Check if there are more links
const hasMoreLinks = computed(() => {
    return (searchLinks.value?.length || 0) > 5
})

// Extract formatted response (everything after the Links section)
const formattedResponse = computed<string | null>(() => {
    const text = resultText.value
    if (!text) return null

    // If no Links section found, return the full text
    if (!text.includes('Links: [')) {
        return text.trim()
    }

    // Find where the Links section ends
    const linksStartIndex = text.indexOf('Links: [')
    let jsonEnd = -1
    let bracketCount = 0

    for (let i = linksStartIndex + 7; i < text.length; i++) {
        if (text[i] === '[') bracketCount++
        if (text[i] === ']') {
            bracketCount--
            if (bracketCount === 0) {
                jsonEnd = i + 1
                break
            }
        }
    }

    if (jsonEnd === -1) return null

    // Extract everything after the Links section, skipping empty lines
    const afterLinks = text.substring(jsonEnd).trim()

    // Remove the "Web search results for query:" prefix if it exists at the beginning
    const cleanedText = afterLinks.replace(/^Web search results for query:.*?\n\n/s, '')

    return cleanedText || null
})
</script>
