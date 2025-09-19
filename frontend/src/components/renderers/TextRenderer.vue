<template>
  <div ref="markdownContainer" class="markdown-body !bg-transparent dark:!text-surface-300" v-html="renderedContent" />
</template>

<script setup lang="ts">
import { computed, watch, nextTick, onMounted } from 'vue'
import { useMarkdownRenderer } from '../../utils/markdownRenderer'
import type { ClaudeMessageWrapper } from '../../types';

interface Props {
  message: ClaudeMessageWrapper
  data: string
}

const props = defineProps<Props>();

const { markdownContainer, renderMarkdown, renderCharts } = useMarkdownRenderer()

const md = computed(() => {
  return props.data
})

// 计算渲染内容
const renderedContent = computed(() => {
  return renderMarkdown(md.value)
})

// 监听内容变化并渲染 Mermaid
watch(renderedContent, async () => {
  await nextTick()
  await renderCharts()
}, { immediate: true })

onMounted(async () => {
  await nextTick()
  await renderCharts()
})
</script>


<style scoped>
/* Mermaid 图表样式 - GitHub markdown CSS 不包含 mermaid 支持 */
.markdown-body :deep(.mermaid) {
  margin: 16px 0;
  text-align: center;
  max-width: 100%;
  overflow-x: auto;
}

.markdown-body :deep(.mermaid svg) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

/* 修复列表样式 - 确保 Tailwind CSS 不会覆盖 GitHub markdown 样式 */
.markdown-body :deep(ul) {
  list-style-type: disc;
}

.markdown-body :deep(ol) {
  list-style-type: decimal;
}

.markdown-body :deep(ul ul),
.markdown-body :deep(ul ol),
.markdown-body :deep(ol ul),
.markdown-body :deep(ol ol) {
  list-style-type: inherit;
}
</style>