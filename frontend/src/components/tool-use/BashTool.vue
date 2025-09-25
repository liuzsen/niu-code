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
                    <span v-if="input.description" class="text-sm text-gray-300">
                        {{ input.description }}
                    </span>

                    <slot name="status"></slot>
                </div>
            </div>
        </div>

        <!-- Terminal Content -->
        <div class="p-4 space-y-3">
            <!-- Command -->
            <div class="flex items-start gap-2">
                <span class="text-green-500 font-mono text-sm font-semibold">$</span>
                <code class="text-green-500 font-mono text-sm leading-relaxed break-all">{{ input.command }}</code>
            </div>

            <slot name="result"></slot>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { BashInput } from '../../types/sdk-tools'

interface Props {
    input: BashInput
}

defineProps<Props>();

</script>
