<template>
    <div>
        <!-- Read Header -->
        <div class="p-4 border-b border-surface-200 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-exclamation-triangle text-red-400"></i>
                    <span class="font-mono font-bold">{{ ` Unknown Tool: ${name}` }}</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <!-- Status indicator -->
                    <div v-if="state == 'running'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Running...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-check-circle text-green-500 text-sm"></i>
                        <span class="text-xs text-green-500">Tool Use Ok</span>
                    </div>
                    <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Error</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="p-4">
            <div class="mb-2">Input</div>
            <div>
                <div class="flex items-start gap-2 bg-surface-200 dark:bg-surface-950 max-h-32 p-4 overflow-auto">
                    {{ JSON.stringify(input, null, 2) }}
                </div>
            </div>
        </div>

        <div v-if="resultText" class="p-4 border-t border-surface-200 dark:border-surface-700">
            <div class="">
                <div class="mb-2">Result</div>
                <div class="bg-surface-200 dark:bg-surface-950 rounded-lg p-4 max-h-32 overflow-auto">
                    <pre class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
                </div>
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
    name: string
    input: unknown
}

const props = defineProps<Props>()

const { toolResult, state, } = useToolUseHandler(props.id)

const resultText = computed(() => {
    const content = toolResult.value?.content;

    if (!content) {
        return "No Result Content"
    }
    if (typeof content == 'string') {
        return extractTaggedContent(content)
    } else if (content[0]?.type == 'text') {
        return extractTaggedContent(content[0].text)
    } else {
        return JSON.stringify(content, undefined, 2)
    }
})

</script>
