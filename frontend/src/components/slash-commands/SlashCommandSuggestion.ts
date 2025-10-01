import { computePosition, flip, shift } from '@floating-ui/dom'
import { posToDOMRect, VueRenderer } from '@tiptap/vue-3'
import { Editor } from '@tiptap/core'
import type { Range } from '@tiptap/core'

import SlashCommandList from './SlashCommandList.vue'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { useChatManager } from '../../stores/chatManager'
import type { SlashCommand } from '@anthropic-ai/claude-code'

export const appCommands: SlashCommand[] = [
  {
    'name': 'clear (reset, new)',
    'description': 'Clear conversation history and free up context',
    "argumentHint": ""
  },
  {
    'name': 'switch',
    'description': 'Switch to another conversation session',
    "argumentHint": ""
  },
  {
    'name': 'resume',
    'description': 'Resume a previous conversation from history',
    "argumentHint": ""
  }
]

const defaultCommands = [
  {
    "name": "compact",
    "description": "Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization]",
    "argumentHint": "<optional custom summarization instructions>"
  },
  {
    "name": "context",
    "description": "Visualize current context usage as a colored grid",
    "argumentHint": ""
  },
  {
    "name": "cost",
    "description": "Show the total cost and duration of the current session",
    "argumentHint": ""
  },
  {
    "name": "init",
    "description": "Initialize a new CLAUDE.md file with codebase documentation",
    "argumentHint": ""
  },
  {
    "name": "output-style:new",
    "description": "Create a custom output style",
    "argumentHint": ""
  },
  {
    "name": "pr-comments",
    "description": "Get comments from a GitHub pull request",
    "argumentHint": ""
  },
  {
    "name": "release-notes",
    "description": "View release notes",
    "argumentHint": ""
  },
  {
    "name": "todos",
    "description": "List current todo items",
    "argumentHint": ""
  },
  {
    "name": "review",
    "description": "Review a pull request",
    "argumentHint": ""
  },
  {
    "name": "security-review",
    "description": "Complete a security review of the pending changes on the current branch",
    "argumentHint": ""
  }
];

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
      if (sdkCommand.name == 'clear (reset, new)') {
        editor.chain().focus().clearContent(true).run()
        const chatManager = useChatManager()
        const chatId = chatManager.foregroundChat.chatId
        messageManager.sendStop(chatId)
        chatManager.chats = []
      }
      else if (sdkCommand.name == 'switch') {
        // 清空输入框
        editor.chain().focus().deleteRange(range).run()

        // 打开会话切换模态框
        // 注意：这里我们使用动态导入来避免循环依赖
        import('../../composables/useSessionSwitch.ts').then(module => {
          const { showSessionList } = module.useSessionSwitch()
          showSessionList(editor)
        })
      }
      else if (sdkCommand.name == 'resume') {
        // 清空输入框
        editor.chain().focus().deleteRange(range).run()

        // 打开历史会话选择模态框
        // 注意：这里我们使用动态导入来避免循环依赖
        import('../../composables/useHistoryResume.ts').then(module => {
          const { showHistorySessionList } = module.useHistoryResume()
          showHistorySessionList(editor)
        })
      }
      else {
        editor.chain().focus().deleteRange(range).insertContent(`/${sdkCommand.name} `).run()
      }
    }
  }
}

export type SelectedCommand = CommandItem;

interface CommandScore {
  item: CommandItem
  score: number
  matchType: 'exact' | 'prefix' | 'wordStart' | 'substring' | 'description' | 'none'
}

// 计算命令匹配分数
const calculateCommandScore = (item: CommandItem, query: string): CommandScore => {
  const lowerQuery = query.toLowerCase()
  const lowerName = item.name.toLowerCase()
  const lowerDescription = item.description.toLowerCase()

  // 精确匹配名称
  if (lowerName === lowerQuery) {
    return { item, score: 100, matchType: 'exact' }
  }

  // 前缀匹配名称
  if (lowerName.startsWith(lowerQuery)) {
    return { item, score: 80, matchType: 'prefix' }
  }

  // 词首匹配（匹配每个单词的首字母）
  const nameWords = lowerName.split(/[\s\-_(),]+/)
  const queryChars = lowerQuery.split('')
  let wordStartMatch = true
  let charIndex = 0

  for (const word of nameWords) {
    if (charIndex >= queryChars.length) break
    if (word.startsWith(queryChars[charIndex])) {
      charIndex++
    } else {
      wordStartMatch = false
      break
    }
  }

  if (wordStartMatch && charIndex === queryChars.length) {
    return { item, score: 60, matchType: 'wordStart' }
  }

  // 子字符串匹配名称
  if (lowerName.includes(lowerQuery)) {
    return { item, score: 40, matchType: 'substring' }
  }

  // 描述匹配
  if (lowerDescription.includes(lowerQuery)) {
    return { item, score: 20, matchType: 'description' }
  }

  return { item, score: 0, matchType: 'none' }
}

// 智能排序函数
const sortCommandsByRelevance = (commands: CommandItem[], query: string): CommandItem[] => {
  if (!query) return commands

  const scoredCommands = commands
    .map(item => calculateCommandScore(item, query))
    .filter(score => score.score > 0)
    .sort((a, b) => {
      // 按分数降序排列
      if (b.score !== a.score) {
        return b.score - a.score
      }
      // 分数相同时，按名称字母顺序排列
      return a.item.name.localeCompare(b.item.name)
    })

  return scoredCommands.map(score => score.item)
}

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
import { messageManager } from '../../services/messageManager'

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
      const chatManager = useChatManager()
      let commands;
      if (chatManager.foregroundChat.session.systemInfo) {
        commands = chatManager.foregroundChat.session.systemInfo.commands.concat(appCommands)
      } else {
        commands = defaultCommands.concat(appCommands)
      }

      const dynamicCommands = commands.map(convertSDKSlashCommandToCommandItem)

      return sortCommandsByRelevance(dynamicCommands, query)
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