import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { Editor } from '@tiptap/core'
import type { Range } from '@tiptap/core'
import { type FileItem, suggestionOptions } from './FileReferenceSuggestion'

interface FileReferenceOptions {
  suggestion: import('@tiptap/suggestion').SuggestionOptions<FileItem, FileItem>
}

export default Extension.create<FileReferenceOptions>({
  name: 'fileReference',

  addOptions() {
    return {
      suggestion: {
        ...suggestionOptions,
        char: '@',
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: FileItem }) => {
          props.command({ editor, range })
        },
        editor: null as unknown as Editor,
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
})
