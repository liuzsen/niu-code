<template>
    <FileWriteTool :input="input">
        <template #status>
            <div class="flex items-center gap-2 flex-1">
                <!-- Status indicator -->
                <div v-if="state == 'pending'" class="flex items-center gap-2 ml-auto">
                    <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                    <span class="text-xs">Writing...</span>
                </div>
                <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                    <i class="pi pi-check-circle text-green-500 text-sm"></i>
                    <span class="text-xs text-green-500">Written</span>
                </div>
                <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                    <i class="pi pi-times-circle text-red-500 text-sm"></i>
                    <span class="text-xs text-red-500">Error</span>
                </div>
            </div>
        </template>
        <template #result>
            <!-- Result/Error -->
            <div v-if="resultText" class="mt-4 border-t-1">
                <div class="text-xs my-2">Result:</div>
                <div class="flex items-start gap-2">
                    <pre class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
                </div>
            </div>
        </template>
    </FileWriteTool>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cleanToolResult } from '../../utils/messageExtractors'
import { useChatStore } from '../../stores/chat'
import ProgressSpinner from 'primevue/progressspinner'
import FileWriteTool from '../tool-use/FileWriteTool.vue'
import type { FileWriteInput } from '../../types/sdk-tools'

interface Props {
    id: string
    input: FileWriteInput
}

const props = defineProps<Props>()
const chatStore = useChatStore()

// 获取命令执行结果
const writeResult = computed(() => {
    return chatStore.getToolResult(props.id)
})

type WriteState = "pending" | "error" | "ok"

const state = computed<WriteState>(() => {
    if (writeResult.value) {
        if (writeResult.value.is_error) {
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
    if (writeResult.value) {
        return cleanToolResult(writeResult.value.content)
    }
    return undefined
})
</script>