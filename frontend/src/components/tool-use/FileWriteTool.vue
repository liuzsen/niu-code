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
                <!-- File Path and Content Stats -->
                <div class="flex items-start gap-2 mb-3">
                    <span class="font-mono text-sm font-semibold">📝</span>
                    <div class="flex items-center gap-2 flex-wrap">
                        <code
                            class="bg-code-block-bg font-mono text-sm leading-relaxed break-all rounded-sm">{{ toRelativePath(input.file_path) }}</code>
                        <span class="text-xs text-caption-text">Content ({{ contentLength }} chars)</span>
                    </div>
                </div>

                <!-- File Content Preview -->
                <ContentPreview :content="input.content" :max-lines="5"
                    :label="toRelativePath(input.file_path)" icon="pi pi-file" />

                <slot name="result"></slot>
            </div>
        </div>
    </div>
</template>


<script setup lang="ts">
import { computed } from 'vue'
import ContentPreview from '../common/ContentPreview.vue'
import type { FileWriteInput } from '../../types/sdk-tools'
import { toRelativePath } from '../../utils/pathProcess'

interface Props {
    input: FileWriteInput
}

const props = defineProps<Props>()

// 内容长度
const contentLength = computed(() => {
    return props.input.content.length
})
</script>
