import type { SDKMessage } from "@anthropic-ai/claude-code";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

// 聊天消息类型
export interface ChatMessage {
    chat_id: string
    data: ChatMessageData
}

export type ChatMessageData =
    | { from: 'human'; content: MessageParam }
    | { from: 'agent'; content: SDKMessage }
