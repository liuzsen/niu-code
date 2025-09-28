import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { Editor } from '@tiptap/core'
import type { Range } from '@tiptap/core'
import { type CommandItem } from './SlashCommandSuggestion'

interface SlashCommandsOptions {
  suggestion: import('@tiptap/suggestion').SuggestionOptions<CommandItem, CommandItem>
}

export default Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: CommandItem }) => {
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