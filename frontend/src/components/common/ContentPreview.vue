<template>
    <div class="relative bg-code-block-bg rounded-lg p-3">
        <!-- Action buttons - fixed position in top right corner -->
        <div class="absolute top-1 right-1 flex items-center gap-1 z-10 rounded">
            <Button size="small" variant="text" @click="copyToClipboard"
                class="w-6 h-6 p-0 bg-button-ghost-bg text-button-ghost-text rounded">
                <i class="pi pi-copy text-xs"></i>
            </Button>
            <Button v-if="hasMoreLines" size="small" variant="text" @click="showFullContent = true"
                class="w-6 h-6 p-0 bg-button-ghost-bg text-button-ghost-text rounded">
                <i class="pi pi-expand text-xs"></i>
            </Button>
        </div>

        <!-- Content preview -->
        <div class="pr-16">
            <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">{{ limitedContent }}</pre>
            <div v-if="hasMoreLines" class="text-xs text-surface-500 dark:text-surface-400 italic mt-2">
                ... {{ totalLines - maxLines }} more lines
            </div>
        </div>
    </div>

    <!-- Full Content Modal -->
    <Dialog v-model:visible="showFullContent" modal class="w-[90vw] max-w-[1000px]" :dismissableMask="true">
        <template #header>
            <div class="flex items-center gap-2">
                <i v-if="icon" :class="icon"></i>
                <span v-if="label" class="bg-code-inline-bg px-2 rounded-sm">{{ label }}</span>
            </div>
        </template>
        <div class="space-y-4">
            <div
                class="bg-code-block-bg rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar border border-surface-300 dark:border-surface-700">
                <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap text-body-text">{{ content }}</pre>
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

interface Props {
    content: string
    maxLines?: number
    label?: string
    icon?: string
}

const props = withDefaults(defineProps<Props>(), {
    maxLines: 5,
    label: undefined,
    icon: undefined
})

const showFullContent = ref(false)

// Split content into lines
const contentLines = computed(() => {
    return props.content.split('\n')
})

// Total line count
const totalLines = computed(() => {
    return contentLines.value.length
})

// Limited content (first N lines)
const limitedContent = computed(() => {
    return contentLines.value.slice(0, props.maxLines).join('\n')
})

// Whether there are more lines than maxLines
const hasMoreLines = computed(() => {
    return totalLines.value > props.maxLines
})

// Copy to clipboard
const copyToClipboard = async () => {
    try {
        await navigator.clipboard.writeText(props.content)
    } catch (err) {
        console.error('Failed to copy text: ', err)
    }
}
</script>
