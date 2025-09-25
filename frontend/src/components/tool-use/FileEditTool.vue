<template>
    <div
        class="bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 shadow-lg rounded-xl">
        <!-- Edit Header -->
        <div class="p-4 border-b border-surface-300 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-file-edit dark:text-surface-500"></i>
                        <span class="text-sm font-mono font-medium">File Edit</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <code class="file-path">
                        {{ toRelativePath(input.file_path) }}
                        </code>
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

                <!-- Changes Summary -->
                <div class="space-y-3">
                    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <div class="text-xs text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                            <i class="pi pi-minus"></i>
                            Old Content ({{ oldStringLength }} chars)
                        </div>
                        <div class="max-h-32 overflow-y-auto custom-scrollbar-dark">
                            <pre
                                class="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">{{ input.old_string }}</pre>
                        </div>
                    </div>
                    <div
                        class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <div class="text-xs text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                            <i class="pi pi-plus"></i>
                            New Content ({{ newStringLength }} chars)
                        </div>
                        <div class="max-h-32 overflow-y-auto custom-scrollbar-dark">
                            <pre
                                class="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">{{ input.new_string }}</pre>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div>
                    <div class="flex items-center justify-end gap-2">
                        <Button size="small" severity="secondary" variant="text" @click="copyOldString">
                            <i class="pi pi-copy text-sm"></i>
                            Copy Old
                        </Button>
                        <Button size="small" severity="secondary" variant="text" @click="copyNewString">
                            <i class="pi pi-copy text-sm"></i>
                            Copy New
                        </Button>
                        <Button size="small" severity="secondary" variant="text" @click="showFullDiff = true">
                            <i class="pi pi-expand text-xs"></i>
                            View Full
                        </Button>
                    </div>
                </div>

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
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">Old Content</div>
                    <div
                        class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-h-[50vh] overflow-y-auto custom-scrollbar-dark">
                        <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ input.old_string }}</pre>
                    </div>
                </div>
                <div>
                    <div class="text-sm font-semibold mb-2 text-green-600 dark:text-green-400">New Content</div>
                    <div
                        class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 max-h-[50vh] overflow-y-auto custom-scrollbar-dark">
                        <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ input.new_string }}</pre>
                    </div>
                </div>
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
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { toRelativePath } from '../../utils/pathProcess'
import type { FileEditInput } from '../../types/sdk-tools'

interface Props {
    input: FileEditInput
}

const props = defineProps<Props>();

const showFullDiff = ref(false)

// Computed properties
const oldStringLength = computed(() => props.input.old_string.length)
const newStringLength = computed(() => props.input.new_string.length)
// const formattedFilePath = computed(() => props.formatPath(props.filePath))

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

<style scoped>
@reference "../../style.css";

.file-path {
    @apply font-mono text-sm leading-relaxed break-all rounded-sm bg-surface-300 dark:bg-surface-700
}
</style>
