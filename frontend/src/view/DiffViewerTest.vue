<script setup lang="ts">
import DiffViewer from '../components/diff/DiffViewer.vue'

// 测试数据：old.txt 内容
const oldText = `    clipboardTextSerializer: (content) => {
      // 将 ProseMirror 内容转换为 HTML
      const div = document.createElement('div')
      const serializer = DOMSerializer.fromSchema(content.type.schema)
      const domFragment = serializer.serializeFragment(content)
      div.appendChild(domFragment)

      const html = div.innerHTML

      // 转换为 Markdown
      return htmlToMarkdown(html)
    },`

// 测试数据：new.txt 内容
const newText = `    clipboardTextSerializer: (slice) => {
      // 将 ProseMirror Slice 的内容转换为 HTML
      const div = document.createElement('div')

      // 从 slice 中获取 fragment 和 schema
      const fragment = slice.content
      const schema = fragment.firstChild?.type.schema || fragment.content[0]?.type.schema

      if (!schema) {
        // 如果无法获取 schema，返回纯文本
        return slice.content.textBetween(0, slice.content.size, '\\n')
      }

      const serializer = DOMSerializer.fromSchema(schema)
      const domFragment = serializer.serializeFragment(fragment)
      div.appendChild(domFragment)

      const html = div.innerHTML

      // 转换为 Markdown
      return htmlToMarkdown(html)
    },`
</script>

<template>
  <div class="diff-test-page">
    <div class="header">
      <h1>🔍 DiffViewer 测试页面</h1>
      <p>测试 old.txt vs new.txt 的 diff 显示效果</p>
    </div>

    <div class="container">
      <!-- Unified 模式 -->
      <div class="panel">
        <h3>📄 Unified 模式</h3>
        <DiffViewer :old-text="oldText" :new-text="newText" mode="unified" />
      </div>

      <!-- Split 模式 -->
      <div class="panel">
        <h3>📊 Split 模式</h3>
        <DiffViewer :old-text="oldText" :new-text="newText" mode="split" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.diff-test-page {
  max-width: 1600px;
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
  grid-template-columns: 1fr;
  gap: 2rem;
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
</style>
