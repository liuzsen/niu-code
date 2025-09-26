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

            <template #result v-if="resultText">
                <div class="border-t border-surface-100 dark:border-surface-700 pt-3">
                    <div class="text-xs mb-2">Result:</div>
                    <div class="bg-surface-50 dark:bg-surface-950 rounded-lg p-3">
                        <pre
                            class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
                    </div>
                </div>
            </template>
        </FileEditTool>

        <PermissionOptions v-if="pendingPermissionRequest && state === 'running'" :request="pendingPermissionRequest!"
            v-model="state">
            <template #question>
                <div class="font-semibold">
                    {{ `Do you want to make this edit to ${extractFileName(input.file_path)}?` }}
                </div>
            </template>
        </PermissionOptions>
    </div>
</template>

<script setup lang="ts">
import { useToolUseHandler } from '../../composables/useToolUseHandler'
import FileEditTool from '../tool-use/FileEditTool.vue'
import ProgressSpinner from 'primevue/progressspinner'
import type { FileEditInput } from '../../types/sdk-tools'
import PermissionOptions from '../PermissionOptions.vue'
import { extractFileName } from '../../utils/pathProcess'

interface Props {
    id: string
    input: FileEditInput
}

const props = defineProps<Props>()

const { pendingPermissionRequest, state, resultText } = useToolUseHandler(props.id)
</script>