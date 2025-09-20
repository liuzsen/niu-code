import type { ChatMessage } from '../types/chat'
import { createClaudeMessageWrapper, type ClaudeMessageWrapper } from '../types/ws-message'
import mockData from '../assets/opcode_expanded.json'
import { type SDKMessage } from '@anthropic-ai/claude-code'

/**
 * Load and convert mock data from JSON file
 */
export function loadMockData(): ChatMessage[] {
  // Convert each JSON message to AgentMessage format
  return mockData.map((rawMessage, index) => {
    // Create ClaudeMessageWrapper
    const claudeMessageWrapper: ClaudeMessageWrapper = createClaudeMessageWrapper(index, rawMessage as SDKMessage);

    // Create AgentMessage
    const agentMessage: ChatMessage = {
      from: 'agent',
      serverMessage: claudeMessageWrapper,
      timestamp: Date.now()
    }

    return agentMessage
  })
}
