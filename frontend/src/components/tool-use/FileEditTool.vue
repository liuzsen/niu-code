<template>
    <div>
        <!-- Edit Header -->
        <div class="p-4 border-b border-surface-100 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-file-edit dark:text-surface-500"></i>
                        <span class="text-sm font-mono font-extrabold">File Edit</span>
                    </div>
                    <div class="bg-code-inline-bg flex items-center gap-2 font-mono text-sm break-all rounded-sm px-1">
                        {{ toRelativePath(input.file_path) }}
                    </div>
                </div>

                <!-- Header slot for status or other content -->
                <div class=" self-end">
                    <slot name="status"></slot>
                </div>
            </div>
        </div>

        <!-- Edit Content -->
        <div class="p-4">
            <div class="space-y-4">
                <!-- File Path -->

                <!-- Diff Viewer -->
                <DiffViewer :old-text="input.old_string" :new-text="input.new_string" mode="unified" :max-lines="10"
                    compact @expand="showFullDiff = true" />

                <!-- Result slot -->
                <slot name="result"></slot>
            </div>
        </div>
    </div>

    <!-- Full Diff Modal -->
    <Dialog v-model:visible="showFullDiff" modal class="w-[90vw] max-w-[1200px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i class="pi pi-file-edit"></i>
                <code class="file-path">
                {{ toRelativePath(input.file_path) }}
                </code>
            </div>
        </template>
        <div class="space-y-4">
            <!-- Full diff viewer with split view -->
            <div class="max-h-[70vh] overflow-y-auto custom-scrollbar-dark">
                <DiffViewer :old-text="input.old_string" :new-text="input.new_string" mode="split" />
            </div>

            <div class="flex justify-end gap-2">
                <Button severity="secondary" @click="copyOldString" size="small">
                    <i class="pi pi-copy mr-1"></i>
                    Copy Old
                </Button>
                <Button severity="secondary" @click="copyNewString" size="small">
                    <i class="pi pi-copy mr-1"></i>
                    Copy New
                </Button>
                <Button severity="secondary" @click="showFullDiff = false" size="small">
                    Close
                </Button>
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import DiffViewer from '../diff/DiffViewer.vue'
import { toRelativePath } from '../../utils/pathProcess'
import type { FileEditInput } from '../../types/sdk-tools'

interface Props {
    input: FileEditInput
}

const props = defineProps<Props>();

const showFullDiff = ref(false)

// Copy to clipboard
const copyOldString = async () => {
    try {
        await navigator.clipboard.writeText(props.input.old_string)
    } catch (err) {
        console.error('Failed to copy old string: ', err)
    }
}

const copyNewString = async () => {
    try {
        await navigator.clipboard.writeText(props.input.new_string)
    } catch (err) {
        console.error('Failed to copy new string: ', err)
    }
}
</script>
