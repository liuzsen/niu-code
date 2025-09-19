<template>
  <div class="flex w-full dark:text-surface-300 font-normal"
    :class="{ 'justify-end': message.from === 'user', 'justify-start': message.from === 'agent' }">
    <div class="flex items-start w-full space-x-2 max-w-3xl"
      :class="{ 'flex-row-reverse space-x-reverse': message.from === 'user' }">
      <div class="flex flex-col flex-1">

        <!-- <div class="flex text-xs gap-2 justify-between px-2">
        </div> -->
        <div class="flex gap-2 text-sm px-2 mb-0.5">
          <p v-if="isUserMessage(message)" class=" text-green-500">Human</p>
          <p v-if="isAgentMessage(message)" class=" dark:text-orange-300 text-surface-700">Main Agent</p>
        </div>

        <div class=" rounded-xl p-4 text-sm bg-surface-100 dark:bg-surface-800">
          <!-- 用户消息 -->
          <MarkdownRenderer v-if="isUserMessage(message)" :content="message.content" />

          <!-- Agent 消息-->
          <div v-else-if="rendererInfo">
            <component :is="rendererInfo.component" :message="rendererInfo.props.message"
              :data="rendererInfo.props.data" :key="message.id" />
          </div>
        </div>

        <div class="flex justify-end mt-0.5 text-gray-500">
          <p class="text-xs mr-2">
            {{ formatTime }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { ChatMessage } from '../types/chat'
import { isUserMessage, isAgentMessage } from '../types/chat'
import type { Component } from 'vue'
import type { ProjectClaudeMessage } from '../types/claude'

// 导入渲染器组件
import SystemRenderer from './renderers/SystemRenderer.vue'
import TextRenderer from './renderers/TextRenderer.vue'
import BashRenderer from './renderers/BashRenderer.vue'
import TodoWriteRenderer from './renderers/TodoWriteRenderer.vue'
import WriteRenderer from './renderers/WriteRenderer.vue'
import ResultRenderer from './renderers/ResultRenderer.vue'
import EditRenderer from './renderers/EditRenderer.vue'
import MultiEditRenderer from './renderers/MultiEditRenderer.vue'
import ReadRenderer from './renderers/ReadRenderer.vue'
import FallbackRenderer from './renderers/FallbackRenderer.vue'
import { extract_system_init, extract_assistant_text, extract_bash, extract_todo_write, extract_write, extract_edit, extract_multi_edit, extract_read, extract_result } from '../utils/messageExtractors'
import MarkdownRenderer from './renderers/MarkdownRenderer.vue'

interface Props {
  message: ChatMessage
}

const props = defineProps<Props>()

// 渲染器结果类型
interface RendererResult {
  component: Component
  props: {
    message: ProjectClaudeMessage
    data: unknown
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
const rendererConfigs: Array<RendererConfig<unknown>> = [
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
  },
  {
    component: TodoWriteRenderer,
    extractor: extract_todo_write
  },
  {
    component: WriteRenderer,
    extractor: extract_write
  },
  {
    component: EditRenderer,
    extractor: extract_edit
  },
  {
    component: MultiEditRenderer,
    extractor: extract_multi_edit
  },
  {
    component: ReadRenderer,
    extractor: extract_read
  },
  {
    component: ResultRenderer,
    extractor: extract_result
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
const rendererInfo = computed(() => {
  if (!isAgentMessage(props.message)) return null

  const claudeMessage = computed(() => {
    if (isAgentMessage(props.message) && props.message.serverMessage.type === 'claude_message') {
      return props.message.serverMessage.data
    }
    return null
  })

  if (!claudeMessage.value) return null

  return getRendererWithContent(claudeMessage.value)
})

// 格式化时间
const formatTime = computed(() => {
  return new Date(props.message.timestamp).toLocaleTimeString()
})
</script>
