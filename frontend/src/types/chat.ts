import type { SDKMessage } from "@anthropic-ai/claude-code";
import type { UserInput } from "./message";

// 聊天消息类型
export interface ChatMessage {
    chat_id: string
    data: ChatMessageData
}

export type ChatMessageData =
    | { from: 'human'; content: UserInput }
    | { from: 'agent'; content: SDKMessage }
