import { ref } from 'vue'
import { marked, Renderer } from 'marked'
import 'github-markdown-css/github-markdown.css'

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

// 创建自定义 marked 渲染器
export const createMarkedRenderer = (): Renderer => {
  const renderer = new Renderer()

  renderer.code = function ({ text: code, lang: language }: { text: string; lang?: string }) {
    const isMermaid =
      language === 'mermaid' ||
      /^\s*(sequenceDiagram|graph[TDL]?|pie|flowchart|classDiagram|stateDiagram|gantt|erDiagram|journey|gitGraph|userJourney|c4Context|mindmap|timeline)/im.test(code.trim())

    if (isMermaid) {
      return `<pre class="mermaid">${code}</pre>`
    }

    const langClass = language ? `language-${language}` : ''
    return `<pre class="!bg-gray-700 !dark:bg-surface-900 !text-surface-200"><code class="${langClass}">${code}</code></pre>`
  }

  return renderer
}

// Mermaid 渲染函数
export const renderMermaidCharts = async (container: HTMLElement) => {
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

// 创建局部 marked 实例
const markedInstance = createMarkedRenderer()

// 组合式函数：使用 markdown 渲染
export const useMarkdownRenderer = () => {
  const markdownContainer = ref<HTMLElement>()

  // 渲染 markdown 内容
  const renderMarkdown = (content: string): string => {
    return content ? marked.parse(content, { renderer: markedInstance, async: false }) as string : ''
  }

  // 渲染 Mermaid 图表
  const renderCharts = async (container?: HTMLElement) => {
    const targetContainer = container || markdownContainer.value
    if (targetContainer) {
      await renderMermaidCharts(targetContainer)
    }
  }

  return {
    markdownContainer,
    renderMarkdown,
    renderCharts
  }
}