<template>
    <MultiEditTool :input="input">
        <template #status>
            <div class="flex items-center gap-2 flex-1">
                <!-- Status indicator -->
                <div v-if="state == 'pending'" class="flex items-center gap-2 ml-auto">
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
            </div>
        </template>

        <template #result>
            <div v-if="resultText" class="border-t border-surface-300 dark:border-surface-700 pt-3">
                <div class="text-xs mb-2">Result:</div>
                <div class="bg-surface-50 dark:bg-surface-900 rounded-lg p-3 overflow-auto">
                    <pre class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
                </div>
            </div>

        </template>
    </MultiEditTool>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cleanToolResult } from '../../utils/messageExtractors'
import { useChatStore } from '../../stores/chat'
import ProgressSpinner from 'primevue/progressspinner'
import type { FileMultiEditInput } from '../../types/sdk-tools'
import MultiEditTool from '../tool-use/MultiEditTool.vue'

interface Props {
    id: string
    input: FileMultiEditInput
}

const props = defineProps<Props>()
const chatStore = useChatStore()

// 获取工具结果
const multiEditResult = computed(() => {
    return chatStore.getToolResult(props.id)
})

type MultiEditState = "pending" | "error" | "ok"

const state = computed<MultiEditState>(() => {
    if (multiEditResult.value) {
        if (multiEditResult.value.is_error) {
            return "error"
        } else {
            return "ok"
        }
    } else {
        return "pending"
    }
})

// 显示结果文本
const resultText = computed(() => {
    if (multiEditResult.value) {
        return cleanToolResult(multiEditResult.value.content)
    }
    return undefined
})
</script>