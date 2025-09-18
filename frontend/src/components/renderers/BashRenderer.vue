<template>
    <Card class=" bg-zinc-800">
        <!-- Terminal Header -->
        <template #title>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="pi pi-terminal text-green-500"></i>
                    <span class="text-sm font-mono text-gray-300">Terminal</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <span class="text-sm ml-2 text-gray-300">></span>
                    <span v-if="data.description" class="text-sm text-gray-300">
                        {{ data.description }}
                    </span>

                    <!-- Loading indicator -->
                    <div v-if="state == 'running'" class="flex items-center gap-2 ml-auto">
                        <ProgressSpinner class="w-3 h-3" stroke-width="4" />
                        <span class="text-xs">Running...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-check-circle text-green-500 text-sm"></i>
                        <span class="text-xs text-green-500">Completed</span>
                    </div>
                    <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                        <i class="pi pi-times-circle text-red-500 text-sm"></i>
                        <span class="text-xs text-red-500">Error</span>
                    </div>
                </div>
            </div>
        </template>

        <!-- Terminal Content -->
        <template #content>
            <div class="space-y-3">
                <!-- Command -->
                <div class="flex items-start gap-2">
                    <span class="text-green-500 font-mono text-sm font-semibold">$</span>
                    <code class="text-green-500 font-mono text-sm leading-relaxed break-all">{{ data.command }}</code>
                </div>

                <!-- Result -->
                <div v-if="resultText" class="mt-3">
                    <div class="flex items-start gap-2">
                        <pre
                            class="text-gray-300 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{{ resultText }}</pre>
                    </div>
                </div>
            </div>
        </template>
    </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectClaudeMessage } from '../../types/claude'
import type { BashData } from '../../utils/messageExtractors'
import { useChatStore } from '../../stores/chat'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'

interface Props {
    message: ProjectClaudeMessage
    data: BashData
}

const props = defineProps<Props>()
const chatStore = useChatStore()

// 获取命令执行结果
const commandResult = computed(() => {
    return chatStore.getToolResult(props.data.id)
})

type CommandState = "running" | "error" | "ok"

const state = computed<CommandState>(() => {
    if (commandResult.value) {
        if (commandResult.value.is_error) {
            return "error"
        } else {
            return "ok"
        }
    } else {
        return "running"
    }
})


// 显示结果文本
const resultText = computed(() => {
    if (commandResult.value) {
        if (typeof commandResult.value.content == "string") {
            return commandResult.value.content
        } else {
            return `unkonwn command result: ${commandResult.value.content}`
        }
    }
    return undefined
})
</script>
