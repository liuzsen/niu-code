<template>
  <div class="flex-1 border border-surface-300 overflow-y-auto p-4 space-y-4" ref="messagesContainer">
    <ChatMessage v-for="message in displayMessages" :key="message.timestamp" :message="message"
      :renderer-info="getRendererInfo(message)" />

    <div v-if="displayMessages.length === 0" class="text-center mt-12" style="color: var(--text-color-secondary)">
      <i class="pi pi-comments text-4xl mb-4 block"></i>
      <p>Welcome to Claude Code Web</p>
      <p class="text-sm mt-2">Connect to start chatting with Claude</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, type Component, computed } from 'vue'
import ChatMessage from './ChatMessage.vue'
import { useChatStore } from '../stores/chat'
import type { ProjectClaudeMessage } from '../types/claude'
import { isAgentMessage } from '../types/chat'

// 导入渲染器组件
import SystemRenderer from './renderers/SystemRenderer.vue'
import TextRenderer from './renderers/TextRenderer.vue'
import BashRenderer from './renderers/BashRenderer.vue'
import FallbackRenderer from './renderers/FallbackRenderer.vue'
import { extract_system_init, extract_assistant_text, extract_bash } from '../utils/messageExtractors'

// 使用统一的聊天 store
const chatStore = useChatStore()
const displayMessages = computed(() => chatStore.standaloneMessages)

// 渲染器结果类型
interface RendererResult {
  component: Component
  props: {
    message: ProjectClaudeMessage
    data: any
  }
}

// 数据提取函数类型
type DataExtractor<T> = (message: ProjectClaudeMessage) => T | null

// 渲染器配置
interface RendererConfig<T> {
  component: Component
  extractor: DataExtractor<T>
}

// 渲染器配置数组
const rendererConfigs: Array<RendererConfig<any>> = [
  {
    component: SystemRenderer,
    extractor: extract_system_init
  },
  {
    component: TextRenderer,
    extractor: extract_assistant_text
  },
  {
    component: BashRenderer,
    extractor: extract_bash
  }
]

// 获取适合的渲染器组件和提取的数据
const getRendererWithContent = (message: ProjectClaudeMessage): RendererResult => {
  // 按照优先级顺序尝试每个提取函数
  for (const config of rendererConfigs) {
    const data = config.extractor(message)
    if (data !== null) {
      return {
        component: config.component,
        props: {
          message,
          data: data
        }
      }
    }
  }

  // 如果没有匹配的渲染器，返回降级渲染器
  return {
    component: FallbackRenderer,
    props: {
      message,
      data: null
    }
  }
}

// 获取消息的渲染器信息
const getRendererInfo = (message: any) => {
  if (!isAgentMessage(message)) return null

  const claudeMessage = computed(() => {
    if (isAgentMessage(message) && message.serverMessage.type === 'claude_message') {
      return message.serverMessage.data
    }
    return null
  })

  if (!claudeMessage.value) return null

  return getRendererWithContent(claudeMessage.value)
}

const messagesContainer = ref<HTMLElement>()

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(displayMessages, scrollToBottom, { deep: true })
</script>