import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chat'

// Mock 数据文件路径
const MOCK_DATA_PATH = '/.local/mock-chat-session.json'

// 响应式的 mock 模式状态
const mockModeEnabled = ref(false)

// 是否在开发环境
const isDevelopment = import.meta.env.DEV

// 是否显示 mock 开关（只在开发环境显示）
export const showMockToggle = import.meta.env.DEV

// 当前的 mock 模式状态
export const isMockMode = computed(() => isDevelopment && mockModeEnabled.value)

// 设置 mock 模式
export function setMockMode(enabled: boolean): void {
  if (!isDevelopment) {
    return
  }

  mockModeEnabled.value = enabled
  console.log(`Mock mode ${enabled ? 'enabled' : 'disabled'}`)

  // 如果启用，立即加载数据
  if (enabled) {
    loadMockData().catch(console.error)
  } else {
    clearMockData()
  }
}

// 切换 mock 模式
export function toggleMockMode(): void {
  setMockMode(!mockModeEnabled.value)
}

// 加载 mock 数据
export async function loadMockData(): Promise<void> {
  const chatStore = useChatStore()

  try {
    chatStore.clearAll()
    const mockData = await import(/* @vite-ignore */ MOCK_DATA_PATH)
    chatStore.loadFromJson(JSON.stringify(mockData))

    console.log('Mock data loaded successfully')
  } catch (error) {
    console.error('Failed to load mock data:', error)
    throw error
  }
}

// 清空 mock 数据，回到正常模式
export function clearMockData(): void {
  const chatStore = useChatStore()
  chatStore.clearAll()
  console.log('Mock data cleared, back to normal mode')
}

// 自动加载 mock 数据（如果在开发模式下）
export async function autoLoadMockData(): Promise<void> {
  // 只在本地开发时生效，默认启用
  if (isDevelopment) {
    setMockMode(true)
  }
}