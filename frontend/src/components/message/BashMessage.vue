<template>
    <div class="flex flex-col gap-2">
        <BashTool :input="input">
            <template #status>
                <!-- Loading indicator -->
                <div v-if="state == 'running'" class="flex items-center gap-2 ml-auto">
                    <div class="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin">
                    </div>
                    <span class="text-xs text-primary-100">Running...</span>
                </div>
                <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                    <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="text-xs text-green-500">Completed</span>
                </div>
                <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                    <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="text-xs text-red-500">Error</span>
                </div>
                <div v-else-if="state === 'rejected'" class="flex items-center gap-2 ml-auto">
                    <i class="pi pi-times-circle text-red-500 text-sm"></i>
                    <span class="text-xs text-red-500">Rejected</span>
                </div>
            </template>
            <template #result>
                <div v-if="resultText" class="relative">
                    <!-- Buttons container in top-right corner -->
                    <div class="absolute top-2 right-4 z-10 flex gap-0">
                        <Button size="small" severity="secondary" variant="text" @click="copyToClipboard">
                            <i class="pi pi-copy text-sm"></i>
                        </Button>
                        <Button size="small" severity="secondary" variant="text" @click="showFullContent = true"
                            class="text-blue">
                            <i class="pi pi-expand text-xs"></i>
                        </Button>
                    </div>

                    <!-- Result content with limited height -->
                    <div class="max-h-32 overflow-auto">
                        <div class="flex items-start gap-2">
                            <pre class="text-gray-300 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap
                                flex-1">{{ resultText }}</pre>
                        </div>
                    </div>
                </div>

                <!-- Full content modal -->
                <Dialog v-model:visible="showFullContent" modal :dismissableMask="true"
                    class="bg-surface-200 dark:bg-surface-900 w-[70%] h-[70%]" :pt="{
                        content: 'overflow-hidden px-4 h-full',
                    }">
                    <template #header>
                        <div class="flex justify-between items-center w-full">
                            <span class="text-lg font-semibold">Command Output</span>
                        </div>
                    </template>
                    <div
                        class="h-full px-2 overflow-auto dark:bg-surface-800 bg-surface-300 rounded-sm custom-scrollbar-light">
                        <pre class="text-gray-800 dark:text-surface-100 font-mono text-sm leading-relaxed break-all
                            whitespace-pre-wrap">{{ resultText }}</pre>
                    </div>
                    <template #footer>
                        <div class="flex justify-end gap-2">
                            <Button severity="secondary" @click="copyToClipboard" size="small">
                                <i class="pi pi-copy mr-1"></i>
                                Copy
                            </Button>
                        </div>
                    </template>
                </Dialog>
            </template>
        </BashTool>

    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BashTool from '../tool-use/BashTool.vue'
import type { BashInput } from '../../types/sdk-tools'
import { useToolUseHandler } from '../../composables/useToolUseHandler'

interface Props {
    id: string
    input: BashInput
}

const props = defineProps<Props>()
const { state, resultText } = useToolUseHandler(props.id)

// Reactive state for modal and clipboard functionality
const showFullContent = ref(false)

// Copy to clipboard function
const copyToClipboard = async () => {
    try {
        if (resultText.value) {
            await navigator.clipboard.writeText(resultText.value)
        }
    } catch (err) {
        console.error('Failed to copy text: ', err)
    }
}
</script>
