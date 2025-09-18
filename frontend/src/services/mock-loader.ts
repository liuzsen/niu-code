import type { ChatMessage } from '../types/chat'
import type { ProjectClaudeMessage } from '../types/claude'
import { createClaudeMessageWrapper } from '../types/ws-message'
import mockData from '../assets/opcode_expanded.json'

/**
 * Load and convert mock data from JSON file
 */
export function loadMockData(): ChatMessage[] {
  const sessionId = 'mock-session-' + Date.now()

  // Convert each JSON message to AgentMessage format
  return mockData.map((rawMessage, index) => {
    // Create ProjectClaudeMessage with type assertion
    const projectClaudeMessage: ProjectClaudeMessage = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sdkMessage: rawMessage as any, // Use type assertion to bypass type checking
      receivedAt: new Date().toISOString(),
      sessionId,
      index,
      timestamp: new Date().toISOString()
    }

    // Create ClaudeMessageWrapper
    const claudeMessageWrapper = createClaudeMessageWrapper(projectClaudeMessage)

    // Create AgentMessage
    const agentMessage: ChatMessage = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: (rawMessage as any).uuid || `msg-${index}`,
      from: 'agent',
      timestamp: Date.now(),
      serverMessage: claudeMessageWrapper
    }

    return agentMessage
  })
}

/**
 * Simulate async loading with delay
 */
export async function loadMockDataAsync(): Promise<ChatMessage[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockMessages = loadMockData()
      console.log(`Loaded ${mockMessages.length} mock messages`)
      resolve(mockMessages)
    }, 500) // Simulate loading delay
  })
}