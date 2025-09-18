import type { ProjectClaudeMessage } from '../types/claude'
import { wsService } from '../services/websocket'
import { useToolCacheStore } from '../stores/toolCache'
import { useRenderableMessagesStore } from '../stores/renderableMessages'
import type { SDKSystemMessage } from '@anthropic-ai/claude-code'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources'

// Bash 数据类型
export interface BashData {
    command: string
    description: string
    id: string
}

// 导出原有的数据提取函数
function is_assistant_msg(m: any): m is any {
    return m.type === "assistant"
}

export function extract_system_init(message: ProjectClaudeMessage): SDKSystemMessage | null {
    const sdkMessage = message.sdkMessage
    if (sdkMessage.type === 'system' && sdkMessage.subtype === 'init') {
        return sdkMessage
    }
    return null
}

export function extract_assistant_text(message: ProjectClaudeMessage): string | null {
    const sdkMessage = message.sdkMessage
    if (is_assistant_msg(sdkMessage)) {
        // 类型断言，因为我们已经检查了类型
        const assistantMsg = sdkMessage as any
        const content = assistantMsg.message?.content || []
        if (Array.isArray(content)) {
            const textContent = content.find((item: { type?: string }) => item.type === 'text')
            if (textContent && 'text' in textContent) {
                return (textContent as any).text
            }
        }
    }
    return null
}

export function extract_bash(message: ProjectClaudeMessage): BashData | null {
    const sdkMessage = message.sdkMessage

    if (!is_assistant_msg(sdkMessage)) return null

    // 类型断言，因为我们已经检查了类型
    const assistantMsg = sdkMessage as any
    const content = assistantMsg.message?.content?.[0]
    if (content?.type !== "tool_use" || content.name !== "Bash") return null

    const input = content.input
    if (!input || typeof input !== "object") return null

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
        }
    }

    return null
}

// 新增：提取工具结果
export function extract_tool_result(message: ProjectClaudeMessage): ToolResultBlockParam | null {
    const sdkMessage = message.sdkMessage

    if (sdkMessage.type !== 'user') {
        return null
    }
    if (sdkMessage.message.role != "user") {
        return null
    }

    if (typeof sdkMessage.message.content == "string") {
        return null
    }

    const content = sdkMessage.message.content[0]

    if (content.type != "tool_result") {
        return null
    }

    return content
}

// 消息处理主函数 - 只负责消息分类和路由
export function useMessageProcessing() {
    const toolCache = useToolCacheStore()
    const renderableStore = useRenderableMessagesStore()

    // 监听 Claude 消息事件
    wsService.onMessage((chatMessage) => {
        if (chatMessage.from == "user") {
            renderableStore.addMessage(chatMessage)
            return
        }

        if (chatMessage.serverMessage.type == 'claude_message') {
            const toolResult = extract_tool_result(chatMessage.serverMessage.data)
            if (toolResult) {
                toolCache.setResult(toolResult.tool_use_id, toolResult)
            } else {
                renderableStore.addMessage(chatMessage)
            }
        } else {
            console.error("unkown message:", chatMessage)
        }

    })
}