<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useMarkdownRenderer } from '../utils/markdownRenderer'

const { markdownContainer, renderMarkdown, renderCharts } = useMarkdownRenderer()

const inputText = ref('')
const renderedContent = ref('')
const statusMessage = ref('')
const statusType = ref<'success' | 'error' | ''>('')

// 渲染 Markdown
const handleRender = async () => {
  try {
    renderedContent.value = renderMarkdown(inputText.value)

    // 等待 DOM 更新完成后再渲染 Mermaid 图表
    await nextTick()
    await renderCharts(markdownContainer.value)

    showStatus('success', '✅ 渲染成功！')
  } catch (error) {
    showStatus('error', `❌ 渲染失败: ${error}`)
    console.error(error)
  }
}

// 清空所有内容
const handleClear = () => {
  inputText.value = ''
  renderedContent.value = ''
  statusMessage.value = ''
  statusType.value = ''
}

// 显示状态消息
const showStatus = (type: 'success' | 'error', message: string) => {
  statusType.value = type
  statusMessage.value = message
  setTimeout(() => {
    statusType.value = ''
    statusMessage.value = ''
  }, 3000)
}

// 测试用例
const insertTest1 = () => {
  inputText.value = `# HTML 代码块测试

这是一个包含 HTML 代码的代码块：

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
  <${'script'}>alert('这不应该执行！')</${'script'}>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>
\`\`\`

如果看到弹窗，说明有 XSS 漏洞！`
}

const insertTest2 = () => {
  inputText.value = `# XSS 攻击测试

尝试注入恶意脚本：

\`\`\`html
<${'script'}>alert('XSS Attack!')</${'script'}>
<img src=x onerror="alert('XSS via img')">
<svg onload="alert('XSS via svg')">
\`\`\`

\`\`\`javascript
<${'script'}>console.log('这也不应该执行')</${'script'}>
\`\`\`

**如果没有弹窗出现，说明转义成功！**`
}

const insertTest3 = () => {
  inputText.value = `# 正常代码高亮测试

## JavaScript 代码

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));
\`\`\`

## Python 代码

\`\`\`python
def hello_world():
    print("Hello, World!")
    return True

if __name__ == "__main__":
    hello_world()
\`\`\`

## TypeScript 代码

\`\`\`typescript
interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
];
\`\`\``
}

const insertTest4 = () => {
  inputText.value = `# Mermaid 图表测试

## 流程图

\`\`\`mermaid
graph TD
    A[开始] --> B{是否转义?}
    B -->|是| C[安全渲染]
    B -->|否| D[XSS 漏洞]
    C --> E[成功]
    D --> F[失败]
\`\`\`

## 时序图

\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant M as Markdown渲染器
    participant E as escapeHtml
    U->>M: 输入HTML代码块
    M->>E: 转义HTML字符
    E-->>M: 返回安全文本
    M-->>U: 显示转义后的代码
\`\`\``
}

const insertTest5 = () => {
  inputText.value = `# 混合内容测试

## 文本和代码混合

这是一段普通文本，包含 **加粗** 和 *斜体*。

\`\`\`html
<div class="container">
  <h1>这是HTML代码</h1>
  <${'script'}>alert('不应该执行')</${'script'}>
</div>
\`\`\`

## 列表

- 列表项 1
- 列表项 2
  - 嵌套项 2.1
  - 嵌套项 2.2
- 列表项 3

## 引用

> 这是一段引用文本
> 可以包含多行

## 链接和图片

[Google](https://google.com)

## 表格

| 特性 | 状态 | 说明 |
|------|------|------|
| HTML转义 | ✅ | 防止XSS |
| 代码高亮 | ✅ | 支持多语言 |
| Mermaid | ✅ | 图表渲染 |

## 内联代码

这是 \`inline code\` 和 \`<${'script'}>alert('test')</${'script'}>\` 测试。`
}

// 页面加载时显示欢迎信息
onMounted(() => {
  inputText.value = `# 👋 欢迎使用 Markdown 渲染器测试工具

点击下方的测试按钮快速插入测试内容，然后点击 **🚀 渲染** 按钮查看效果。

## 测试说明

- **测试1**: 验证 HTML 代码块是否被正确转义
- **测试2**: 验证 XSS 攻击是否被阻止
- **测试3**: 验证代码高亮功能
- **测试4**: 验证 Mermaid 图表渲染
- **测试5**: 验证混合内容渲染`
})
</script>

<template>
  <div class="markdown-test-page">
    <div class="header">
      <h1>🧪 Markdown 渲染器测试</h1>
      <p>测试 Markdown 渲染器，特别是 HTML 代码块的安全性</p>
    </div>

    <div class="container">
      <!-- 左侧：输入面板 -->
      <div class="panel">
        <h3>📝 输入 Markdown</h3>
        <Textarea
          v-model="inputText"
          rows="20"
          placeholder="在这里输入 Markdown 内容..."
          class="input-area"
        />

        <div class="button-group">
          <Button label="🚀 渲染" severity="info" @click="handleRender" />
          <Button label="🗑️ 清空" severity="secondary" @click="handleClear" />
        </div>

        <div class="button-group test-buttons">
          <Button label="测试1: HTML 代码块" severity="success" size="small" @click="insertTest1" />
          <Button label="测试2: XSS 攻击" severity="success" size="small" @click="insertTest2" />
          <Button label="测试3: 正常代码" severity="success" size="small" @click="insertTest3" />
          <Button label="测试4: Mermaid 图表" severity="success" size="small" @click="insertTest4" />
          <Button label="测试5: 混合内容" severity="success" size="small" @click="insertTest5" />
        </div>

        <Message
          v-if="statusMessage"
          :severity="statusType === 'success' ? 'success' : 'error'"
          :closable="false"
        >
          {{ statusMessage }}
        </Message>
      </div>

      <!-- 右侧：渲染效果面板 -->
      <div class="panel">
        <h3>👁️ 渲染效果</h3>
        <div
          ref="markdownContainer"
          class="output-area markdown-body"
          v-html="renderedContent"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.markdown-test-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
  text-align: center;
}

.header h1 {
  margin: 0 0 0.5rem 0;
  color: var(--p-primary-color);
}

.header p {
  margin: 0;
  color: var(--p-text-muted-color);
}

.container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.panel {
  background: var(--p-surface-0);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--p-surface-border);
}

.panel h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--p-text-color);
  border-bottom: 2px solid var(--p-primary-color);
  padding-bottom: 0.5rem;
}

.input-area {
  width: 100%;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  margin-bottom: 1rem;
}

.button-group {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.test-buttons {
  margin-top: 0.5rem;
}

.output-area {
  min-height: 500px;
  padding: 1rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 4px;
  background: var(--p-surface-50);
  overflow-x: auto;
}

/* Markdown 样式 */
.markdown-body {
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .container {
    grid-template-columns: 1fr;
  }
}
</style>
