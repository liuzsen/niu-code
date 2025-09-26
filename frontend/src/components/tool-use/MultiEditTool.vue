<template>
    <div>
        <!-- MultiEdit Header -->
        <div class="p-3 border-b border-surface-100 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-file-multiple dark:text-surface-500"></i>
                    <span class="font-mono font-bold">Multi Edit</span>
                    <span class="text-xs text-surface-500">({{ editCount }} changes)</span>
                </div>

                <slot name="status"></slot>
            </div>
        </div>

        <!-- MultiEdit Content -->
        <div class="p-4">
            <div class="space-y-4">
                <!-- File Path -->
                <div class="flex items-start gap-2">
                    <span class="font-mono text-sm font-semibold">📁</span>
                    <code
                        class="font-mono text-sm leading-relaxed break-all">{{ toRelativePath(input.file_path) }}</code>
                </div>

                <!-- Edit List -->
                <div class="space-y-3">
                    <div v-for="(edit, index) in input.edits" :key="index"
                        class="border border-surface-500 dark:border-surface-600 rounded-lg p-2">
                        <div class="text-xs text-gray-600 mb-2 flex items-center gap-2">
                            <i class="pi pi-code"></i>
                            Edit #{{ index + 1 }}
                            <span v-if="edit.replace_all"
                                class="text-xs bg-surface-200 dark:bg-surface-700 px-2 py-1 rounded">replace_all</span>
                        </div>

                        <div class="space-y-2">
                            <div
                                class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                                <div class="text-xs text-red-600 dark:text-red-400 mb-1">Old Content:</div>
                                <div class="max-h-24 overflow-y-auto custom-scrollbar-dark">
                                    <pre
                                        class="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{{ edit.old_string }}</pre>
                                </div>
                            </div>
                            <div
                                class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
                                <div class="text-xs text-green-600 dark:text-green-400 mb-1">New Content:</div>
                                <div class="max-h-24 overflow-y-auto custom-scrollbar-dark">
                                    <pre
                                        class="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{{ edit.new_string }}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center justify-end">
                    <div class="flex items-center gap-2">
                        <Button size="small" severity="secondary" variant="text" @click="showFullEdits = true">
                            <i class="pi pi-expand text-xs"></i>
                            View All Changes
                        </Button>
                    </div>
                </div>

                <slot name="result"></slot>
            </div>
        </div>
    </div>

    <!-- Full Edits Modal -->
    <Dialog v-model:visible="showFullEdits" modal class="w-[90vw] max-w-[1400px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i class="pi pi-file-multiple"></i>
                Multi Edit: {{ input.file_path }}
                <span class="text-sm text-surface-500">({{ editCount }} changes)</span>
            </div>
        </template>
        <div class="space-y-4">
            <div class="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar-dark">
                <div v-for="(edit, index) in input.edits" :key="index"
                    class="border border-surface-300 dark:border-surface-600 rounded-lg p-4">
                    <div class="text-sm font-semibold mb-3 flex items-center gap-2">
                        <i class="pi pi-code"></i>
                        Edit #{{ index + 1 }}
                        <span v-if="edit.replace_all"
                            class="text-xs bg-surface-200 dark:bg-surface-700 px-2 py-1 rounded">replace_all</span>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <div class="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">Old Content</div>
                            <div
                                class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-h-[40vh] overflow-y-auto custom-scrollbar-dark">
                                <pre
                                    class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ edit.old_string }}</pre>
                            </div>
                        </div>
                        <div>
                            <div class="text-sm font-semibold mb-2 text-green-600 dark:text-green-400">New Content</div>
                            <div
                                class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 max-h-[40vh] overflow-y-auto custom-scrollbar-dark">
                                <pre
                                    class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ edit.new_string }}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex justify-end gap-2">
                <Button severity="secondary" @click="showFullEdits = false" size="small">
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
import type { FileMultiEditInput } from '../../types/sdk-tools'
import { toRelativePath } from '../../utils/pathProcess'

interface Props {
    input: FileMultiEditInput
}

const props = defineProps<Props>()
const showFullEdits = ref(false)

// 显示编辑数量
const editCount = computed(() => {
    return props.input.edits.length
})

</script>