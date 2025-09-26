<template>
    <div class="flex flex-col gap-2">
        <FileEditTool :input="input">
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
                    <div v-else-if="state === 'rejected'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Rejected</span>
                    </div>
                </div>
            </template>

            <template #result v-if="resultText">
                <div class="border-t border-surface-300 dark:border-surface-700 pt-3">
                    <div class="text-xs mb-2">Result:</div>
                    <div class="bg-surface-50 dark:bg-surface-900 rounded-lg p-3">
                        <pre
                            class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
                    </div>
                </div>
            </template>
        </FileEditTool>

        <PermissionOptions v-if="pendingPermissionRequest && state === 'pending'" :request="pendingPermissionRequest!"
            @permission-selected="handlePermission">
            <template #question>
                <div class="font-semibold">
                    {{ `Do you want to make this edit to ${extractFileName(input.file_path)}?` }}
                </div>
            </template>
        </PermissionOptions>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cleanToolResult } from '../../utils/messageExtractors'
import { useChatStore } from '../../stores/chat'
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
const chatStore = useChatStore()
const pendingPermissionRequest = computed(() => chatStore.pendingPermissionRequest)

// 获取命令执行结果
const editResult = computed(() => {
    return chatStore.getToolResult(props.id)
})

type EditState = "pending" | "error" | "ok" | "rejected"

const state = ref<EditState>("pending")

watch(editResult, () => {
    if (state.value == 'rejected') {
        return
    }
    if (editResult.value) {
        if (editResult.value.is_error) {
            state.value = "error"
        } else {
            state.value = "ok"
        }
    }
}, {
    immediate: true
})

const handlePermission = (result: "allow" | "deny") => {
    if (result == 'deny') {
        state.value = "rejected"
    }
}

// 显示结果文本
const resultText = computed(() => {
    if (editResult.value) {
        return cleanToolResult(editResult.value.content)
    }
    return undefined
})
</script>