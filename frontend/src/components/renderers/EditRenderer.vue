<template>
    <FileEditTool :input="data">
        <template #status>
            <div>
                <div v-if="state === 'pending'" class="flex items-center gap-2 ml-auto">
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

        <template #result v-if="resultText">
            <div class="border-t border-surface-300 dark:border-surface-700 pt-3">
                <div class="text-xs mb-2">Result:</div>
                <div class="bg-surface-50 dark:bg-surface-900 rounded-lg p-3">
                    <pre class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
                </div>
            </div>
        </template>
    </FileEditTool>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditData } from '../../utils/messageExtractors'
import { cleanToolResult } from '../../utils/messageExtractors'
import { useChatStore } from '../../stores/chat'
import FileEditTool from '../tool-use/FileEditTool.vue'
import ProgressSpinner from 'primevue/progressspinner'
import type { SDKMessage } from '@anthropic-ai/claude-code'

interface Props {
    message: SDKMessage
    data: EditData
}

const props = defineProps<Props>()
const chatStore = useChatStore()

// 获取命令执行结果
const editResult = computed(() => {
    return chatStore.getToolResult(props.data.id)
})

type EditState = "pending" | "error" | "ok"

const state = computed<EditState>(() => {
    if (editResult.value) {
        if (editResult.value.is_error) {
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
    if (editResult.value) {
        return cleanToolResult(editResult.value.content)
    }
    return undefined
})
</script>