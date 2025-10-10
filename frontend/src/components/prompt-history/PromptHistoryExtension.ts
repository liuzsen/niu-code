import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionOptions } from '@tiptap/suggestion'
import type { PromptHistoryItem } from './PromptHistorySuggestion'

interface PromptHistoryOptions {
  suggestion: SuggestionOptions<PromptHistoryItem, PromptHistoryItem>
}

export const PromptHistoryExtension = Extension.create<PromptHistoryOptions>({
  name: 'promptHistory',

  addOptions() {
    return {
      suggestion: {
        char: '\u0012', // Ctrl+R character (DC2)
        items: () => [],
        render: () => ({}),
        editor: null as unknown as import('@tiptap/core').Editor,
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        ...this.options.suggestion,
        editor: this.editor,
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-r': () => {
        // Insert the trigger character to activate the suggestion
        this.editor.commands.insertContent('\u0012')
        return true
      },
    }
  },
})
