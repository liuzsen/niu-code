import { ref, computed } from 'vue'
import type { Editor } from '@tiptap/core'
import Fuse from 'fuse.js'
import { marked } from 'marked'
import { promptHistoryService } from '../../services/promptHistory'
import type { PromptRecord } from '../../types/prompt'

// Global cache for prompt history
const cachedPrompts = ref<PromptRecord[]>([])

// Create Fuse instance with optimized configuration
const fuseInstance = computed(() => new Fuse(cachedPrompts.value, {
  keys: [
    {
      name: 'content',
      weight: 0.8, // Higher weight for content matching
    },
    {
      name: 'timestamp',
      weight: 0.2, // Lower weight for recency
    }
  ],
  threshold: 0.4, // More lenient for better fuzzy matching
  includeScore: true,
  minMatchCharLength: 1,
  ignoreLocation: true,
  shouldSort: true, // Sort by score for best matches first
}))

// Subscribe to prompt history service to populate cache
promptHistoryService.subscribe({
  onPromptReceived: (record) => {
    // Add to beginning (newest first)
    cachedPrompts.value.unshift(record)
  },
  onError: (error) => {
    console.error('Prompt history service error:', error)
  }
})

// Modal state
const isVisible = ref(false)
let currentEditor: Editor | null = null

export function usePromptHistoryModal() {
  const show = (editor: Editor) => {
    currentEditor = editor
    isVisible.value = true
  }

  const hide = () => {
    isVisible.value = false
    if (currentEditor) {
      currentEditor.commands.focus()
    }
    currentEditor = null
  }

  const selectPrompt = (content: string) => {
    if (currentEditor) {
      // Convert Markdown to HTML before inserting
      const html = marked.parse(content, {
        async: false,
        breaks: true, // Single line breaks convert to <br>
        gfm: true, // GitHub Flavored Markdown
      }) as string
      console.log(html)

      // Replace entire content with selected prompt (converted to HTML)
      currentEditor.chain()
        .focus()
        .deleteRange({ from: 0, to: currentEditor.state.doc.content.size })
        .insertContent(html)
        .run()
    }
    hide()
  }

  return {
    isVisible,
    cachedPrompts: computed(() => cachedPrompts.value),
    fuseInstance,
    show,
    hide,
    selectPrompt,
  }
}
