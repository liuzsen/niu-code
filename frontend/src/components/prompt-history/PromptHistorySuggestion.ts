import { computePosition, flip, shift } from '@floating-ui/dom'
import { posToDOMRect, VueRenderer } from '@tiptap/vue-3'
import type { Editor } from '@tiptap/core'
import type { Range } from '@tiptap/core'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import Fuse from 'fuse.js'

import PromptHistoryList from './PromptHistoryList.vue'
import { promptHistoryService } from '../../services/promptHistory'
import type { PromptRecord } from '../../types/prompt'

export interface PromptHistoryItem extends PromptRecord {
  command: ({ editor, range }: { editor: Editor; range: Range }) => void
}

interface UpdatePositionParams {
  x: number
  y: number
  strategy: string
}

const updatePosition = (editor: Editor, element: HTMLElement) => {
  const virtualElement = {
    getBoundingClientRect: () => posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to),
  }

  computePosition(virtualElement, element, {
    placement: 'top-start',
    strategy: 'absolute',
    middleware: [shift(), flip()],
  }).then(({ x, y, strategy }: UpdatePositionParams) => {
    element.style.width = '600px'
    element.style.maxWidth = '90vw'
    element.style.position = strategy
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

export type PromptHistorySuggestionProps = SuggestionProps<PromptHistoryItem, PromptHistoryItem>
export type PromptHistorySuggestionOptions = SuggestionOptions<PromptHistoryItem, PromptHistoryItem>

export const promptHistoryPluginKey = new PluginKey('prompt-history-suggestion')

// Global cache fcachedPromptsor prompt history and Fuse instance
const cachedPrompts: PromptRecord[] = []
const fuseInstance: Fuse<PromptRecord> = newFuse([])

// Create new Fuse instance with optimized configuration
function newFuse(prompts: PromptRecord[]) {
  return new Fuse(prompts, {
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
  })
}

// Add prompt to cache (incremental updates)
export const addPromptToCache = (prompt: PromptRecord) => {
  // Add to beginning (newest first)
  cachedPrompts?.unshift(prompt)
  fuseInstance?.add(prompt)
}

// Subscribe to prompt history service to populate cache
promptHistoryService.subscribe({
  onPromptReceived: (record) => {
    addPromptToCache(record)
  },
  onError: (error) => {
    console.error('Prompt history service error:', error)
  }
})

export const createPromptHistorySuggestion = (): PromptHistorySuggestionOptions => ({
  pluginKey: promptHistoryPluginKey,
  char: '\u0012', // Ctrl+R character (DC2) - matches PromptHistoryExtension
  allowSpaces: true,
  editor: null as unknown as Editor,

  command: ({ editor, props }: { editor: Editor; range: Range; props: PromptHistoryItem }) => {
    // Delete the trigger character first, then execute the command
    editor.chain().focus().run()
    props.command({ editor, range: { from: 0, to: editor.state.doc.content.size } })
  },

  items: ({ query }: { query: string }): PromptHistoryItem[] => {
    console.log("query:", query)
    // If no cached prompts, return empty array
    if (!cachedPrompts.length) {
      return []
    }

    let filteredPrompts: PromptRecord[]

    // If no query, return all prompts
    if (!query || query.trim() === '') {
      filteredPrompts = cachedPrompts
    } else {

      const results = fuseInstance.search(query)
      filteredPrompts = results.map(result => result.item)
    }

    // Convert to items with command
    const items: PromptHistoryItem[] = filteredPrompts.map(record => ({
      ...record,
      command: ({ editor }) => {
        // Replace entire content with selected prompt
        editor.chain().focus().deleteRange({ from: 0, to: editor.state.doc.content.size }).insertContent(record.content).run()
      }
    }))

    return items
  },

  render: () => {
    let component: VueRenderer | null = null

    return {
      onStart: (props) => {
        component = new VueRenderer(PromptHistoryList, {
          props: {
            items: props.items,
            command: props.command,
            query: props.query || '',
            allPrompts: cachedPrompts,
            fuseInstance: fuseInstance,
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
            command: props.command,
            query: props.query || '',
            allPrompts: cachedPrompts,
            fuseInstance: fuseInstance,
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
            component.destroy()
            if (component.element) {
              component.element.remove()
            }
          }
          return true
        }

        if (!component) return false

        const componentRef = component.ref as { onKeyDown: (event: KeyboardEvent) => boolean }
        return componentRef.onKeyDown(props.event)
      },

      onExit() {
        if (component) {
          component.destroy()
          if (component.element) {
            component.element.remove()
          }
          component = null
        }
      },
    }
  },
})
