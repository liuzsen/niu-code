import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { computePosition, flip, shift } from '@floating-ui/dom'
import { posToDOMRect, VueRenderer } from '@tiptap/vue-3'
import { exitSuggestion } from '@tiptap/suggestion'
import type { Editor, Range } from '@tiptap/core'
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { PluginKey } from '@tiptap/pm/state'
import type { Component } from 'vue'

interface UpdatePositionParams {
  x: number
  y: number
  strategy: string
}

/**
 * 更新建议列表的位置
 */
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

/**
 * 创建通用的 Suggestion 渲染器
 */
function createSuggestionRenderer(
  listComponent: Component,
  pluginKey: PluginKey
) {
  return () => {
    let component: VueRenderer | null = null

    return {
      onStart: <TItem, TSelected>(props: SuggestionProps<TItem, TSelected>) => {
        component = new VueRenderer(listComponent, {
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

      onUpdate: <TItem, TSelected>(props: SuggestionProps<TItem, TSelected>) => {
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

      onKeyDown: (props: SuggestionKeyDownProps) => {
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
  }
}

/**
 * 配置接口
 */
export interface SuggestionConfig<TItem, TSelected = TItem> {
  /** 扩展名称 */
  name: string
  /** 触发字符 */
  char: string
  /** PluginKey */
  pluginKey: PluginKey
  /** Vue 列表组件 */
  listComponent: Component
  /** 获取建议项的函数 */
  items: (params: { query: string; editor: Editor }) => TItem[] | Promise<TItem[]>
  /** 执行命令的函数 */
  command: (params: { editor: Editor; range: Range; props: TSelected }) => void
}

/**
 * 创建通用的 Suggestion Extension
 */
export function createSuggestionExtension<TItem, TSelected = TItem>(
  config: SuggestionConfig<TItem, TSelected>
) {
  return Extension.create({
    name: config.name,

    addOptions() {
      return {
        suggestion: {
          pluginKey: config.pluginKey,
          char: config.char,
          items: config.items,
          command: config.command,
          render: createSuggestionRenderer(
            config.listComponent,
            config.pluginKey
          ),
          editor: null as unknown as Editor,
        } as SuggestionOptions<TItem, TSelected>,
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
}
