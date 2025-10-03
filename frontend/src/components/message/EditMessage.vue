<template>
    <div class="flex flex-col">
        <FileEditTool :input="input">
            <template #status>
                <div>
                    <div v-if="state === 'running'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Editing...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-check-circle text-green-500 text-sm"></i>
                        <span class="text-xs text-green-500">Edited</span>
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
            </template>
        </FileEditTool>

    </div>
</template>

<script setup lang="ts">
import { useToolUseHandler } from '../../composables/useToolUseHandler'
import FileEditTool from '../tool-use/FileEditTool.vue'
import ProgressSpinner from 'primevue/progressspinner'
import type { FileEditInput } from '../../types/sdk-tools'

interface Props {
    id: string
    input: FileEditInput
}

const props = defineProps<Props>()

const { state } = useToolUseHandler(props.id)
</script>