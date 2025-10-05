import { computePosition, flip, shift } from '@floating-ui/dom'
import { posToDOMRect, VueRenderer } from '@tiptap/vue-3'
import { Editor } from '@tiptap/core'
import type { Range } from '@tiptap/core'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { exitSuggestion } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import Fuse from 'fuse.js'

import FileReferenceList from './FileReferenceList.vue'

export interface FileItem {
  path: string
  command: ({ editor, range }: { editor: Editor; range: Range }) => void
}

interface UpdatePositionParams {
  x: number
  y: number
  strategy: string
}

// 全局缓存文件列表和 Fuse 实例
let cachedFiles: string[] = []
let fuseInstance: Fuse<string> | null = null

// 加载文件列表到缓存
export const loadFileList = async (files: string[]) => {
  cachedFiles = files

  // 初始化 Fuse 实例
  fuseInstance = new Fuse(cachedFiles, {
    threshold: 0.3,
    includeScore: true,
  })
}

// 转换文件路径为 FileItem
const convertPathToFileItem = (path: string): FileItem => {
  return {
    path,
    command: ({ editor }) => {
      // 插入文件路径
      editor.chain().focus().insertContent(path + ' ').run()
    }
  }
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

export type FileSuggestionProps = SuggestionProps<FileItem, FileItem>
export type FileSuggestionOptions = SuggestionOptions<FileItem, FileItem>

export const fileReferencePluginKey = new PluginKey("file-reference-suggestion")

export const suggestionOptions: FileSuggestionOptions = {
  pluginKey: fileReferencePluginKey,
  char: '@',
  command: ({ editor, range, props }: { editor: Editor; range: Range; props: FileItem }) => {
    props.command({ editor, range })
  },
  editor: null as unknown as Editor,

  items: ({ query }: { query: string }): FileItem[] => {
    // 如果没有缓存的文件列表，返回空数组
    if (!cachedFiles.length) {
      return []
    }

    let filteredPaths: string[]

    // 如果没有查询，返回所有文件（最多10个）
    if (!query) {
      filteredPaths = cachedFiles.slice(0, 10)
    } else {
      // 使用 Fuse.js 进行模糊搜索
      if (!fuseInstance) {
        fuseInstance = new Fuse(cachedFiles, {
          threshold: 0.3,
          includeScore: true,
        })
      }

      const results = fuseInstance.search(query)
      filteredPaths = results.map(result => result.item).slice(0, 10)
    }

    return filteredPaths.map(convertPathToFileItem)
  },

  render: () => {
    let component: VueRenderer | null = null

    return {
      onStart: (props) => {
        component = new VueRenderer(FileReferenceList, {
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
              exitSuggestion(editor.view, fileReferencePluginKey)
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
