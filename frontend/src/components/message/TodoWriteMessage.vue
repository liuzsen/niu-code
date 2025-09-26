<template>
    <div class="py-2 px-4">
        <!-- Todo List Header -->
        <div class="flex items-center gap-2 border-surface-500 mb-3">
            <i class="pi pi-list dark:text-surface-400"></i>
            <span class="ml-1">Todo List</span>
        </div>

        <!-- Todo List Content -->
        <div class="flex flex-col gap-3">
            <div v-for="(todo, index) in input.todos" :key="index"
                class="transition-colors hover:bg-surface-100 dark:hover:bg-surface-950 rounded-sm bg-surface-200 dark:bg-surface-800">
                <div class="flex items-start p-2 gap-2" :class="{ '': index !== input.todos.length - 1 }">
                    <!-- Status Icon -->
                    <div class="flex-shrink-0 mt-0.5">
                        <i class="" :class="{
                            ' bg-gray-50 pi pi-circle rounded-full': todo.status == 'pending',
                            'text-primary-400 pi pi-spin pi-spinner': todo.status === 'in_progress',
                            'text-green-500 pi pi-check-circle': todo.status === 'completed',
                        }" />
                    </div>

                    <!-- Todo Content -->
                    <div class="text-sm font-medium flex-1 min-w-0">
                        {{ todo.content }}
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { TodoWriteInput } from '../../types/sdk-tools';

interface Props {
    id: string
    input: TodoWriteInput
}

defineProps<Props>()

</script>

<style scoped>
/* 确保小图标尺寸一致 */
.pi {
    font-size: 1rem;
}

/* 任务项悬停效果 */
.transition-colors {
    transition: background-color 0.2s ease;
}

/* 文本溢出处理 */
.min-w-0 {
    min-width: 0;
}
</style>