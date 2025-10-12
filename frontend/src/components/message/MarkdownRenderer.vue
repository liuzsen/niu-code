<template>
  <div class="user-message-renderer">
    <div ref="markdownContainer" class="markdown-body" v-html="renderedContent" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useMarkdownRenderer } from '../../utils/markdownRenderer'

const props = defineProps<{
  content: string
}>()

const { markdownContainer, renderMarkdown, renderCharts } = useMarkdownRenderer()
const renderedContent = ref('')

const updateContent = async () => {
  renderedContent.value = renderMarkdown(props.content)
  await nextTick()
  await renderCharts()
}

onMounted(updateContent)

watch(() => props.content, updateContent, { immediate: true })
</script>

<style scoped>
:deep(.markdown-body) {
  color: var(--color-body-text);
  background: transparent;
}

:deep(pre) {
  background-color: var(--color-code-block-bg);
  color: var(--color-body-text);
}

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