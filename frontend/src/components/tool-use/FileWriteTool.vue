<template>
    <div class="shadow-lg rounded-sm">
        <!-- Write Header -->
        <div class="p-4 border-b border-border-subtle">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-file dark:text-surface-500"></i>
                    <span class="text-sm font-mono">File Write</span>
                </div>

                <slot name="status"></slot>
            </div>
        </div>

        <!-- Write Content -->
        <div class="p-4">
            <div class="">
                <!-- File Path -->
                <div class="flex items-start gap-2">
                    <span class="font-mono text-sm font-semibold">📝</span>
                    <code
                        class="bg-code-block-bg font-mono text-sm leading-relaxed break-all rounded-sm">{{ toRelativePath(input.file_path) }}</code>
                </div>

                <!-- File Content (preview) -->
                <div class="">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-surface-400 text-xs">Content ({{ contentLength }} chars):</div>
                        <div class="flex items-center gap-2">
                            <Button size="small" severity="secondary" variant="text" @click="copyToClipboard">
                                <i class="pi pi-copy text-sm"></i>
                                Copy
                            </Button>
                            <Button size="small" severity="secondary" variant="text" @click="showFullContent = true">
                                <i class="pi pi-expand text-xs"></i>
                                View Full
                            </Button>
                        </div>
                    </div>
                    <div class="bg-code-block-bg p-3 max-h-40 overflow-y-auto custom-scrollbar-dark">
                        <pre
                            class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ input.content }}</pre>
                    </div>
                </div>

                <slot name="result"></slot>
            </div>
        </div>
    </div>

    <!-- Full Content Modal -->
    <Dialog v-model:visible="showFullContent" modal class="w-[90vw] max-w-[1000px]" :dismissableMask="true">
        <template #header>
            <div class="file-path">
                {{ toRelativePath(input.file_path) }}
            </div>
        </template>
        <div class="space-y-4">
            <div
                class="bg-surface-100 dark:bg-surface-900 rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar-dark border border-surface-600">
                <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap">{{ input.content }}</pre>
            </div>
            <div class="flex justify-end gap-2">
                <Button severity="secondary" @click="copyToClipboard" size="small">
                    <i class="pi pi-copy mr-1"></i>
                    Copy
                </Button>
                <Button severity="secondary" @click="showFullContent = false" size="small">
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
import type { FileWriteInput } from '../../types/sdk-tools'
import { toRelativePath } from '../../utils/pathProcess'

interface Props {
    input: FileWriteInput
}

const props = defineProps<Props>()
const showFullContent = ref(false)


// 内容长度
const contentLength = computed(() => {
    return props.input.content.length
})

// 复制到剪贴板
const copyToClipboard = async () => {
    try {
        await navigator.clipboard.writeText(props.input.content)
    } catch (err) {
        console.error('Failed to copy text: ', err)
    }
}
</script>
