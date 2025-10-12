<template>
    <div>
        <!-- MCP Tool Header -->
        <div class="p-4 border-b border-border-subtle">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-box text-blue-400"></i>
                    <span class="font-mono font-bold">{{ toolName }}</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <!-- Status indicator -->
                    <div v-if="state == 'running'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Running...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-check-circle text-green-500 text-sm"></i>
                        <span class="text-xs text-green-500">Completed</span>
                    </div>
                    <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Error</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Input Section -->
        <div class="p-4">
            <div class="mb-2 text-sm text-surface-600 dark:text-surface-400">Input</div>
            <div class="bg-code-block-bg rounded p-4 overflow-auto max-h-48">
                <pre class="font-mono text-xs leading-relaxed">{{ formattedInput }}</pre>
            </div>
        </div>

        <!-- Result Section -->
        <div v-if="resultText" class="p-4 border-t border-border-subtle">
            <div class="mb-2 text-sm text-surface-600 dark:text-surface-400">Result</div>
            <div class="bg-code-block-bg rounded p-4 max-h-48 overflow-auto">
                <pre class="font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import { useToolUseHandler } from '../../composables/useToolUseHandler'
import { extractTaggedContent } from '../../utils/messageExtractors'

interface Props {
    id: string
    toolName: string
    input: unknown
}

const props = defineProps<Props>()

const { toolResult, state } = useToolUseHandler(props.id)

const formattedInput = computed(() => {
    return JSON.stringify(props.input, null, 2)
})

const resultText = computed(() => {
    const content = toolResult.value?.content;

    if (!content) {
        return null
    }
    if (typeof content == 'string') {
        return extractTaggedContent(content)
    } else if (content[0]?.type == 'text') {
        return extractTaggedContent(content[0].text)
    } else {
        return JSON.stringify(content, null, 2)
    }
})
</script>
