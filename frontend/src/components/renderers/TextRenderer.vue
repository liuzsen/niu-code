<template>
  <div ref="markdownContainer" class="markdown-body !bg-transparent" v-html="renderedContent" />
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { marked, Renderer } from 'marked'
import 'github-markdown-css/github-markdown.css'
import type { ProjectClaudeMessage, } from '../../types';

// 动态导入 mermaid 以减小初始包大小
interface MermaidInstance {
  initialize: (config: { startOnLoad: boolean; theme: string }) => void
  render: (id: string, code: string) => Promise<{ svg: string }>
}

let mermaidInstance: MermaidInstance | null = null
const loadMermaid = async () => {
  if (!mermaidInstance) {
    const mermaidModule = await import('mermaid')
    const instance = mermaidModule.default as MermaidInstance
    instance.initialize({
      startOnLoad: false,
      theme: 'default'
    })
    mermaidInstance = instance
  }
  return mermaidInstance
}

interface Props {
  message: ProjectClaudeMessage
  data: string
}

const props = defineProps<Props>();

const md = computed(() => {
  return props.data
})

const markdownContainer = ref<HTMLElement>()

// 创建自定义 marked 渲染器
const createRenderer = (): Renderer => {
  const renderer = new Renderer()

  renderer.code = function ({ text: code, lang: language }: { text: string; lang?: string }) {
    const isMermaid =
      language === 'mermaid' ||
      /^\s*(sequenceDiagram|graph[TDL]?|pie|flowchart|classDiagram|stateDiagram|gantt|erDiagram|journey|gitGraph|userJourney|c4Context|mindmap|timeline)/im.test(code.trim())

    if (isMermaid) {
      return `<pre class="mermaid">${code}</pre>`
    }

    const langClass = language ? `language-${language}` : ''
    return `<pre><code class="${langClass}">${code}</code></pre>`
  }

  return renderer
}

// 创建局部 marked 实例
const markedInstance = createRenderer()

// Mermaid 渲染函数
const renderMermaidCharts = async (container: HTMLElement) => {
  if (!container) return

  const mermaidElements = container.querySelectorAll('.mermaid')
  if (mermaidElements.length === 0) return

  // 只在有 mermaid 图表时才加载 mermaid 库
  const mermaid = await loadMermaid()

  for (let idx = 0; idx < mermaidElements.length; idx++) {
    try {
      const element = mermaidElements[idx] as HTMLElement
      const code = element.textContent?.trim() || ''
      if (!code) continue

      const uniqueId = `mermaid-${Date.now()}-${idx}`
      const { svg } = await mermaid.render(uniqueId, code)

      element.innerHTML = svg
    } catch (error) {
      console.error('Mermaid 渲染错误:', error)
      const element = mermaidElements[idx] as HTMLElement
      element.innerHTML = `<div style="color: #ff4d4f; padding: 8px;">图表渲染失败: ${error}</div>`
    }
  }
}

// 计算渲染内容
const renderedContent = computed(() => {
  return md.value ? marked.parse(md.value, { renderer: markedInstance }) : ''
})

// 监听内容变化并渲染 Mermaid
watch(renderedContent, async () => {
  await nextTick()
  if (markdownContainer.value) {
    await renderMermaidCharts(markdownContainer.value)
  }
}, { immediate: true })

onMounted(async () => {
  await nextTick()
  if (markdownContainer.value) {
    await renderMermaidCharts(markdownContainer.value)
  }
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