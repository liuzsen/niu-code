<template>
    <div class="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
        <!-- Terminal Header -->
        <div class="px-4 py-3 border-b border-zinc-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
                        </path>
                    </svg>
                    <span class="text-sm font-mono text-gray-300">Terminal</span>
                </div>

                <div class="flex items-center gap-2 flex-1">
                    <span class="text-sm ml-2 text-gray-300">></span>
                    <span v-if="data.description" class="text-sm text-gray-300">
                        {{ data.description }}
                    </span>

                    <!-- Loading indicator -->
                    <div v-if="state == 'running'" class="flex items-center gap-2 ml-auto">
                        <div class="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin">
                        </div>
                        <span class="text-xs">Running...</span>
                    </div>
                    <div v-else-if="state === 'ok'" class="flex items-center gap-2 ml-auto">
                        <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-xs text-green-500">Completed</span>
                    </div>
                    <div v-else-if="state === 'error'" class="flex items-center gap-2 ml-auto">
                        <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-xs text-red-500">Error</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Terminal Content -->
        <div class="p-4 space-y-3">
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
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BashData } from '../../utils/messageExtractors'
import { cleanToolResult } from '../../utils/messageExtractors'
import { useChatStore } from '../../stores/chat'
import type { SDKMessage } from '@anthropic-ai/claude-code'

interface Props {
    message: SDKMessage
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
        return cleanToolResult(commandResult.value.content)
    }
    return undefined
})
</script>
