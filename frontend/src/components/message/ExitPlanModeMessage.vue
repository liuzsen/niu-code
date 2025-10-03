<template>
    <div class="flex flex-col gap-2">
        <!-- Read Header -->
        <div class="p-4 border-b border-surface-200 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="font-mono font-bold">Plan</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <!-- Status indicator -->
                    <div v-if="state == 'running'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Waiting...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-check-circle text-green-500 text-sm"></i>
                        <span class="text-xs text-green-500">Approved</span>
                    </div>
                    <div v-else-if="state === 'rejected'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Rejected</span>
                    </div>
                </div>
            </div>
        </div>

        <MarkdownRenderer :content="input.plan" class="p-4"></MarkdownRenderer>

    </div>
</template>

<script setup lang="ts">
import type { ExitPlanModeInput } from '../../types/sdk-tools'
import { ref, onMounted } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import type { ToolUseState } from '../../types'
import ProgressSpinner from 'primevue/progressspinner'

interface Props {
    id: string
    input: ExitPlanModeInput
}

defineProps<Props>()

const state = ref<ToolUseState>('running')

// Monitor pending request to update state
onMounted(() => {
    const checkState = () => {
        // TODO: CHECK STATE
    }
    checkState()
})

</script>
