import { computed, watch, type Ref } from 'vue'
import { useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { DOMSerializer, Slice } from '@tiptap/pm/model'
import { htmlToMarkdown } from '../utils/contentConverter'
import { createSuggestionExtension } from '../components/suggestions/createSuggestionExtension'
import { slashCommandPluginKey, getSlashCommandItems, type CommandItem } from '../components/suggestions/slash-commands/config'
import { fileReferencePluginKey, getFileReferenceItems, type FileItem } from '../components/suggestions/file-reference/config'
import SlashCommandList from '../components/suggestions/slash-commands/SlashCommandList.vue'
import FileReferenceList from '../components/suggestions/file-reference/FileReferenceList.vue'
import { usePromptHistoryModal } from '../components/prompt-history/usePromptHistoryModal'
import { useWorkspace } from '../stores/workspace'
import { useWebSocket } from './useWebSocket'
import '../assets/tiptap.css'
import type { EditorView } from '@tiptap/pm/view'

/**
 * 消息编辑器配置选项
 */
export interface MessageEditorOptions {
  /** 是否正在生成（用于 Ctrl+C 中断） */
  isGenerating: Ref<boolean>
  /** 中断生成的回调 */
  onStopGeneration: () => void
  /** 发送消息的回调 */
  onSendMessage: (markdown: string) => void
}

function clipboardTextSerializer(slice: Slice) {
  const div = document.createElement('div')
  const fragment = slice.content
  const schema = fragment.firstChild?.type.schema || fragment.content[0]?.type.schema

  if (!schema) {
    return slice.content.textBetween(0, slice.content.size, '\n')
  }

  const serializer = DOMSerializer.fromSchema(schema)
  const domFragment = serializer.serializeFragment(fragment)
  div.appendChild(domFragment)

  const html = div.innerHTML
  return htmlToMarkdown(html)
}

function handlePaste(view: EditorView, event: ClipboardEvent): boolean {
  const clipboardData = event.clipboardData
  if (!clipboardData) return false

  // 检查是否包含文件（图片）
  const files = Array.from(clipboardData.files)
  const images = files.filter(file => file.type.startsWith('image/'))

  if (images.length > 0) {
    // TODO: 处理图片粘贴
    console.log('Image pasted:', images)
    event.preventDefault()
    return true
  }

  // 处理纯文本粘贴 - 移除所有格式（包括代码块）
  const text = clipboardData.getData('text/plain')
  if (text) {
    view.dispatch(view.state.tr.insertText(text))
    return true
  }

  return false
}

/**
 * TipTap 消息编辑器 Composable
 *
 * 封装了编辑器配置、键盘事件处理、粘贴处理等所有编辑器相关逻辑
 */
export function useMessageEditor(options: MessageEditorOptions) {
  const workspace = useWorkspace()
  const { state: websocketState } = useWebSocket()
  const promptHistoryModal = usePromptHistoryModal()

  // 创建斜杠命令扩展
  const SlashCommandsExtension = createSuggestionExtension<CommandItem, CommandItem>({
    name: 'slashCommands',
    char: '/',
    pluginKey: slashCommandPluginKey,
    listComponent: SlashCommandList,
    items: getSlashCommandItems,
    command: ({ editor, range, props }) => {
      props.command({ editor, range })
    },
  })

  // 创建文件引用扩展
  const FileReferenceExtension = createSuggestionExtension<FileItem, FileItem>({
    name: 'fileReference',
    char: '@',
    pluginKey: fileReferencePluginKey,
    listComponent: FileReferenceList,
    items: getFileReferenceItems,
    command: ({ editor, range, props }) => {
      props.command({ editor, range })
    },
  })

  // 编辑器可用状态
  const editable = computed(() => {
    if (websocketState.reconnecting) {
      return false
    }

    if (!workspace.hasWorkingDirectory) {
      return false
    }

    return true
  })

  // 禁用原因提示
  const disabledTooltip = computed(() => {
    if (websocketState.reconnecting) {
      return 'WebSocket 正在重连，请稍候...'
    }

    if (!workspace.hasWorkingDirectory) {
      return '请先选择工作目录'
    }

    return ''
  })

  // 初始化 TipTap 编辑器
  const editor = useEditor({
    content: '',
    extensions: [
      StarterKit.configure({
        link: false,  // 禁用链接自动识别
      }),
      SlashCommandsExtension,
      FileReferenceExtension,
    ],
    editable: editable.value,
    autofocus: true,
    onCreate: ({ editor }) => {
      editor.commands.focus()
    },
    editorProps: {
      // 复制时转换为 Markdown
      clipboardTextSerializer: clipboardTextSerializer,

      // 粘贴处理
      handlePaste: handlePaste,

      // 键盘事件处理
      handleKeyDown: function handleKeyDown(view: EditorView, event: KeyboardEvent) {
        // Shift+Enter: 换行
        if (event.key === 'Enter' && event.shiftKey) {
          Object.defineProperty(event, 'shiftKey', {
            get: () => false
          })
          return false
        }

        // Ctrl+R: 打开历史对话搜索
        if (event.ctrlKey && event.key === 'r') {
          event.preventDefault()
          if (editor.value) {
            promptHistoryModal.show(editor.value)
          }
          return true
        }

        // Ctrl+C: 停止生成（仅在无文本选中时）
        if (event.ctrlKey && event.key === 'c' && options.isGenerating.value) {
          const hasSelection = !view.state.selection.empty
          if (hasSelection) {
            return false // 允许复制选中文本
          }

          event.preventDefault()
          options.onStopGeneration()
          return true
        }

        // Enter: 发送消息（如果没有建议列表显示）
        if (event.key === 'Enter') {
          // 检查斜杠命令建议列表是否正在显示
          const slashSuggestionState = slashCommandPluginKey.getState(view.state)
          if (slashSuggestionState?.active) {
            return false
          }

          // 检查文件引用建议列表是否正在显示
          const fileSuggestionState = fileReferencePluginKey.getState(view.state)
          if (fileSuggestionState?.active) {
            return false
          }

          // 建议列表未显示，发送消息
          handleSend()
          return true
        }

        return false
      },

      attributes: {
        class: 'prose prose-sm focus:outline-none',
      },
    }
  })

  // 监听禁用状态变化
  watch(editable, (newEditable) => {
    if (editor.value) {
      editor.value.commands.focus()
      editor.value.setEditable(newEditable)
    }
  }, { immediate: true })

  /**
   * 发送消息
   */
  const handleSend = () => {
    if (!editor.value || editor.value.isEmpty) return

    const textContent = editor.value.getText()
    if (!textContent.trim()) return

    const htmlContent = editor.value.getHTML()
    const markdownContent = htmlToMarkdown(htmlContent)

    options.onSendMessage(markdownContent)

    editor.value.commands.focus()
    editor.value.commands.clearContent()
  }

  /**
   * 聚焦编辑器
   */
  const focus = () => {
    editor.value?.commands.focus()
  }

  /**
   * 清空编辑器
   */
  const clear = () => {
    editor.value?.commands.clearContent()
  }

  return {
    editor,
    editable,
    disabledTooltip,
    promptHistoryModal,
    handleSend,
    focus,
    clear,
  }
}
