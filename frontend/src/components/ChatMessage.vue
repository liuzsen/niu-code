<template>
  <div class="flex w-full dark:text-surface-300 font-normal"
    :class="{ 'justify-end': message.data.from === 'human', 'justify-start': message.data.from === 'agent' }">
    <div class="flex items-start w-full space-x-2 max-w-full"
      :class="{ 'flex-row-reverse space-x-reverse': message.data.from === 'human' }">
      <div class="flex flex-col w-full">

        <div class="flex gap-2 text-sm px-0 mb-0.5">
          <p v-if="message.data.from === 'human'" class=" text-green-500">Human</p>
          <p v-if="message.data.from === 'agent'" class=" dark:text-orange-300 text-surface-700">Main Agent</p>
        </div>

        <div class=" rounded-sm text-sm bg-surface-300 dark:bg-surface-900">
          <!-- 用户消息 -->
          <div v-if="message.data.from === 'human'" class="p-4">
            <MarkdownRenderer :content="message.data.content.content" />
          </div>

          <!-- Agent 消息-->
          <div v-else>
            <div v-if="assistant_text">
              <TextRenderer :input="assistant_text"></TextRenderer>
            </div>
            <div v-else-if="claude_user_text">
              <ClaudeUserMessage :content="claude_user_text"></ClaudeUserMessage>
            </div>
            <div v-else-if="systemt_init">
              <SystemRenderer :data="systemt_init"></SystemRenderer>
            </div>
            <div v-else-if="result_msg">
              <ResultRenderer :data="result_msg"></ResultRenderer>
            </div>
            <div v-else-if="tool_use" :key="tool_use.id">
              <EditRenderer v-if="tool_use.tool_use.tool_name == 'Edit'" :id="tool_use.id"
                :input="tool_use.tool_use.input">
              </EditRenderer>
              <WriteRenderer v-else-if="tool_use.tool_use.tool_name == 'Write'" :id="tool_use.id"
                :input="tool_use.tool_use.input">
              </WriteRenderer>
              <BashRenderer v-else-if="tool_use.tool_use.tool_name == 'Bash'" :id="tool_use.id"
                :input="tool_use.tool_use.input">
              </BashRenderer>
              <MultiEditRenderer v-else-if="tool_use.tool_use.tool_name == 'MultiEdit'" :id="tool_use.id"
                :input="tool_use.tool_use.input">
              </MultiEditRenderer>
              <ReadRenderer v-else-if="tool_use.tool_use.tool_name == 'Read'" :id="tool_use.id"
                :input="tool_use.tool_use.input">
              </ReadRenderer>
              <TodoWriteRenderer v-else-if="tool_use.tool_use.tool_name == 'TodoWrite'" :id="tool_use.id"
                :input="tool_use.tool_use.input"></TodoWriteRenderer>
              <ExitPlanModeMessage v-else-if="tool_use.tool_use.tool_name == 'ExitPlanMode'" :id="tool_use.id"
                :input="tool_use.tool_use.input"></ExitPlanModeMessage>
            </div>
            <div v-else-if="unknown_tool_use" :key="unknown_tool_use.id">
              <UnknownToolUseMessage :id="unknown_tool_use.id" :name="unknown_tool_use.tool_use.tool_name"
                :input="unknown_tool_use.tool_use.input">
              </UnknownToolUseMessage>
            </div>
            <div v-else>
              <FallbackRenderer :data="message"></FallbackRenderer>
            </div>
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

// 导入渲染器组件
import SystemRenderer from './message/SystemMessage.vue'
import TextRenderer from './message/TextMessage.vue'
import TodoWriteRenderer from './message/TodoWriteMessage.vue'
import WriteRenderer from './message/WriteMessage.vue'
import ResultRenderer from './message/ResultMessage.vue'
import EditRenderer from './message/EditMessage.vue'
import MultiEditRenderer from './message/MultiEditMessage.vue'
import ReadRenderer from './message/ReadMessage.vue'
import FallbackRenderer from './message/FallbackMessage.vue'
import { extract_system_init, extract_assistant_text, extract_result, extract_tool_use, extract_unknown_tool_use, extract_claude_user_text } from '../utils/messageExtractors'
import MarkdownRenderer from './message/MarkdownRenderer.vue'
import BashRenderer from './message/BashMessage.vue'
import ExitPlanModeMessage from './message/ExitPlanModeMessage.vue'
import UnknownToolUseMessage from './message/UnknownToolUseMessage.vue'
import ClaudeUserMessage from './message/ClaudeUserMessage.vue'

interface Props {
  message: ChatMessage
}

const props = defineProps<Props>()

const tool_use = computed(() => {
  if (props.message.data.from != "agent") {
    return undefined
  }

  return extract_tool_use(props.message.data.content)
})

const unknown_tool_use = computed(() => {
  if (props.message.data.from != "agent") {
    return undefined
  }

  return extract_unknown_tool_use(props.message.data.content)
})


const assistant_text = computed(() => {
  if (props.message.data.from != 'agent') {
    return undefined
  }

  return extract_assistant_text(props.message.data.content)
})

const claude_user_text = computed(() => {
  if (props.message.data.from != 'agent') {
    return undefined
  }

  return extract_claude_user_text(props.message.data.content)
})


const systemt_init = computed(() => {
  if (props.message.data.from != 'agent') {
    return undefined
  }

  return extract_system_init(props.message.data.content)
})

const result_msg = computed(() => {
  if (props.message.data.from != 'agent') {
    return undefined
  }

  return extract_result(props.message.data.content)
})


// 格式化时间
const formatTime = computed(() => {
  return new Date().toLocaleTimeString()
})
</script>
