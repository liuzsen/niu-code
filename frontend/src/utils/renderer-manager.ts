import type { ProjectClaudeMessage, SDKMessage } from '../types/claude'
import type { SDKAssistantMessage, SDKSystemMessage } from '@anthropic-ai/claude-code'
import SystemRenderer from '../components/renderers/SystemRenderer.vue'
import TextRenderer from '../components/renderers/TextRenderer.vue'
import FallbackRenderer from '../components/renderers/FallbackRenderer.vue'

// 定义渲染器结果类型
interface RendererResult {
  component: any
  props: {
    message: ProjectClaudeMessage
    data: any
  }
}

// 定义数据提取函数类型
type DataExtractor<T> = (message: ProjectClaudeMessage) => T | null

// 定义渲染器配置
interface RendererConfig<T> {
  component: any
  extractor: DataExtractor<T>
}

// 类型守卫函数
function is_assistant_msg(m: SDKMessage): m is SDKAssistantMessage {
  return m.type === "assistant"
}

export function extract_system_init(message: ProjectClaudeMessage): SDKSystemMessage | null {
  const sdkMessage = message.sdkMessage
  if (sdkMessage.type === 'system' && sdkMessage.subtype === 'init') {
    return sdkMessage
  }
  return null
}

// 助手文本数据提取
export function extract_assistant_text(message: ProjectClaudeMessage): string | null {
  const sdkMessage = message.sdkMessage
  if (is_assistant_msg(sdkMessage)) {
    const content = sdkMessage.message?.content || []
    if (Array.isArray(content)) {
      const textContent = content.find((item: { type?: string }) => item.type === 'text')
      if (textContent && 'text' in textContent) {
        return (textContent as any).text
      }
    }
  }
  return null
}

// Bash 工具数据提取
export interface BashData {
  command: string,
  description: string,
  id: string
}

export function extract_bash(message: ProjectClaudeMessage): BashData | null {
  const sdkMessage = message.sdkMessage;

  if (!is_assistant_msg(sdkMessage)) return null;

  const content = sdkMessage.message.content[0];
  if (content?.type !== "tool_use" || content.name !== "Bash") return null;

  const input = content.input;
  if (!input || typeof input !== "object") return null;

  if (
    'command' in input &&
    'description' in input &&
    typeof input.command === 'string' &&
    typeof input.description === 'string'
  ) {
    return {
      command: input.command,
      description: input.description,
      id: content.id,
    };
  }

  return null;
}

// 新的渲染器管理器
export class NewRendererManager {
  // 定义渲染器配置数组
  private rendererConfigs: Array<RendererConfig<any>> = [
    {
      component: SystemRenderer,
      extractor: extract_system_init
    },
    {
      component: TextRenderer,
      extractor: extract_assistant_text
    },
    // 可以后续添加更多渲染器
    // {
    //   component: BashRenderer,
    //   extractor: extract_bash
    // },
    // {
    //   component: TodoWriteRenderer,
    //   extractor: extract_todo_write
    // },
    // {
    //   component: WriteRenderer,
    //   extractor: extract_write
    // }
  ]

  // 获取适合的渲染器组件和提取的数据
  getRendererWithContent(message: ProjectClaudeMessage): RendererResult {
    // 按照优先级顺序尝试每个提取函数
    for (const config of this.rendererConfigs) {
      const data = config.extractor(message)
      if (data !== null) {
        return {
          component: config.component,
          props: {
            message,
            data: data
          }
        }
      }
    }

    // 如果没有匹配的渲染器，返回降级渲染器
    return {
      component: FallbackRenderer,
      props: {
        message,
        data: null
      }
    }
  }
}

// 导出单例实例
export const rendererManager = new NewRendererManager()
