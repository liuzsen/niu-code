<template>
  <div class="fallback-renderer">
    <pre class="json-content">{{ JSON.stringify(message, null, 2) }}</pre>
  </div>
</template>

<script setup lang="ts">
import type { SDKMessage } from '@anthropic-ai/claude-code';

interface Props {
  message: SDKMessage
  data: unknown
}

defineProps<Props>()

</script>

<style scoped>
.fallback-renderer {
  background-color: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 1rem;
}

.renderer-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
}

.json-content {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-color);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background-color: var(--surface-card);
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--surface-d);
}
</style>