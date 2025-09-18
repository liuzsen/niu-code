<template>
    <Card class="bg-zinc-800">
        <!-- Todo List Header -->
        <template #title>
            <div class="flex items-center gap-2">
                <i class="pi pi-list text-blue-500"></i>
                <span class="text-sm font-semibold text-gray-300">Todo List</span>
            </div>
        </template>

        <!-- Todo List Content -->
        <template #content>
            <div class="space-y-2">
                <div v-for="(todo, index) in data.todos" :key="index"
                    class="flex items-start gap-3 p-2 rounded-lg transition-colors"
                    :class="getTodoItemClass(todo.status)">
                    <!-- Status Icon -->
                    <div class="flex-shrink-0 mt-0.5">
                        <i :class="[getStatusIcon(todo.status), getStatusIconClass(todo.status)]" />
                    </div>

                    <!-- Todo Content -->
                    <div class="text-sm font-medium text-gray-200 flex-1 min-w-0">
                        {{ todo.content }}
                    </div>

                    <!-- Status Badge -->
                    <div class="flex-shrink-0">
                        <Badge :value="getStatusText(todo.status)" :severity="getStatusSeverity(todo.status)"
                            size="small" />
                    </div>
                </div>
            </div>
        </template>
    </Card>
</template>

<script setup lang="ts">
import type { ProjectClaudeMessage } from '../../types/claude'
import type { TodoWriteData } from '../../utils/messageExtractors'
import Card from 'primevue/card'
import Badge from 'primevue/badge'

interface Props {
    message: ProjectClaudeMessage
    data: TodoWriteData
}

defineProps<Props>()

// 获取任务项的样式类
function getTodoItemClass(status: string): string {
    switch (status) {
        case 'pending':
            return 'hover:bg-gray-700/50'
        case 'in_progress':
            return 'bg-blue-900/20 hover:bg-blue-800/30 border-l-2 border-blue-500'
        case 'completed':
            return 'bg-green-900/20 hover:bg-green-800/30'
        default:
            return 'hover:bg-gray-700/50'
    }
}

// 获取状态图标
function getStatusIcon(status: string): string {
    switch (status) {
        case 'pending':
            return 'pi pi-circle'
        case 'in_progress':
            return 'pi pi-spin pi-spinner'
        case 'completed':
            return 'pi pi-check-circle'
        default:
            return 'pi pi-circle'
    }
}

// 获取状态图标样式类
function getStatusIconClass(status: string): string {
    switch (status) {
        case 'pending':
            return 'text-gray-400'
        case 'in_progress':
            return 'text-blue-500'
        case 'completed':
            return 'text-green-500'
        default:
            return 'text-gray-400'
    }
}

// 获取状态文本
function getStatusText(status: string): string {
    switch (status) {
        case 'pending':
            return '待处理'
        case 'in_progress':
            return '进行中'
        case 'completed':
            return '已完成'
        default:
            return '未知'
    }
}

// 获取状态严重程度
function getStatusSeverity(status: string): 'info' | 'success' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
        case 'pending':
            return 'secondary'
        case 'in_progress':
            return 'info'
        case 'completed':
            return 'success'
        default:
            return 'secondary'
    }
}
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