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
                <div v-if="resultText" class="">
                    <div class="flex items-start gap-2">
                        <pre class="text-gray-300 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText
                        }}</pre>
                    </div>
                </div>
            </template>
        </BashTool>
        <PermissionOptions v-if="pendingPermissionRequest && state === 'running'" :request="pendingPermissionRequest!"
            v-model="state">
            <template #question>
                <div class="font-semibold">
                    {{ "Do you want to proceed?" }}
                </div>
            </template>
        </PermissionOptions>

    </div>
</template>

<script setup lang="ts">
import BashTool from '../tool-use/BashTool.vue'
import type { BashInput } from '../../types/sdk-tools'
import PermissionOptions from '../PermissionOptions.vue'
import { useToolUseHandler } from '../../composables/useToolUseHandler'

interface Props {
    id: string
    input: BashInput
}

const props = defineProps<Props>()
const { pendingPermissionRequest, state, resultText } = useToolUseHandler(props.id)
</script>
