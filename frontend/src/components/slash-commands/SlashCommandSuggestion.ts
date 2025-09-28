import { computePosition, flip, shift } from '@floating-ui/dom'
import { posToDOMRect, VueRenderer } from '@tiptap/vue-3'
import { Editor } from '@tiptap/core'
import type { Range } from '@tiptap/core'

import SlashCommandList from './SlashCommandList.vue'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { useChatStore } from '../../stores/chat'
import type { SlashCommand } from '@anthropic-ai/claude-code'

interface UpdatePositionParams {
  x: number
  y: number
  strategy: string
}

export interface CommandItem {
  name: string
  description: string
  command: ({ editor, range }: { editor: Editor; range: Range }) => void
}

// 将 SDK 的 SlashCommand 转换为我们的 CommandItem 格式
export const convertSDKSlashCommandToCommandItem = (sdkCommand: SlashCommand): CommandItem => {
  return {
    name: sdkCommand.name,
    description: sdkCommand.description,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(`/${sdkCommand.name} `).run()
    }
  }
}

export type SelectedCommand = CommandItem;

const updatePosition = (editor: Editor, element: HTMLElement) => {
  const virtualElement = {
    getBoundingClientRect: () => posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to),
  }

  computePosition(virtualElement, element, {
    placement: 'bottom-start',
    strategy: 'absolute',
    middleware: [shift(), flip()],
  }).then(({ x, y, strategy }: UpdatePositionParams) => {
    element.style.width = 'max-content'
    element.style.position = strategy
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

import { exitSuggestion } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'

export type CommandSuggestionProps = SuggestionProps<CommandItem, SelectedCommand>
export type CommandSuggestionOptions = SuggestionOptions<CommandItem, SelectedCommand>

const pluginKey = new PluginKey("slash-command-suggestion")

export const suggestionOptions: CommandSuggestionOptions = {
  pluginKey: pluginKey,
  char: '/',
  command: ({ editor, range, props }: { editor: Editor; range: Range; props: CommandItem }) => {
    props.command({ editor, range })
  },
  editor: null as unknown as Editor,

  items: ({ query }: { query: string }) => {
    try {
      const chatStore = useChatStore()
      if (!chatStore.systemInfo?.commands) {
        return []
      }
      const dynamicCommands = chatStore.systemInfo.commands.map(convertSDKSlashCommandToCommandItem)
      return dynamicCommands
        .filter(item =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase())
        )
    } catch {
      // 如果 Pinia 还未初始化，返回空数组
      return []
    }
  },

  render: () => {
    let component: VueRenderer | null = null

    return {
      onStart: (props) => {
        component = new VueRenderer(SlashCommandList, {
          props: {
            items: props.items,
            command: props.command
          },
          editor: props.editor,
        })

        if (props.clientRect && props.clientRect()) {
          (component.element as HTMLElement).style.position = 'absolute'
          document.body.appendChild(component.element as Node)
          updatePosition(props.editor, component.element as HTMLElement)
        }
      },

      onUpdate: (props) => {
        if (component) {
          component.updateProps({
            items: props.items,
            command: props.command
          })

          if (props.clientRect && props.clientRect()) {
            updatePosition(props.editor, component.element as HTMLElement)
          }
        }
      },

      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          props.event.preventDefault()
          if (component) {
            const editor = component.editor
            component.destroy()
            if (component.element) {
              component.element.remove()
            }
            if (editor) {
              editor.commands.focus()
              exitSuggestion(editor.view, pluginKey)
            }
          }
          return true
        }
        return (component!.ref as { onKeyDown: (event: KeyboardEvent) => boolean })!.onKeyDown(props.event)
      },

      onExit() {
        if (component) {
          component.destroy()
          if (component.element) {
            component.element.remove()
          }
        }
      },
    }
  },
} 