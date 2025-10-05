import { ref, computed } from 'vue'
import { useChatManager } from '../stores/chat'

export const isDevelopment = import.meta.env.DEV

// 获取 .local/mocks 目录下的所有 JSON 文件
const mockFileModules = import.meta.glob('/.local/mocks/*.json')

export const mockFiles = (() => {
  const paths = Object.keys(mockFileModules)

  return paths.map(path => {
    // 提取文件名：从任意路径格式中提取纯文件名
    const filename = path.split('/').pop()?.replace('.json', '') || path
    return filename
  })
})()

// 响应式的当前选中的 mock 文件
const selectedMockFile = ref<string | null>(null)

// 当前的 mock 模式状态
export const isMockMode = computed(() => isDevelopment && selectedMockFile.value !== null)

// 获取当前选中的 mock 文件
export const currentMockFile = computed(() => selectedMockFile.value)

// 加载指定的 mock 文件
export async function loadMockFile(filename: string): Promise<void> {
  if (!isDevelopment) {
    return
  }

  try {
    const chatManager = useChatManager()

    // 通过文件名查找对应的模块
    const found = Object.keys(mockFileModules).find(path => {
      const pathFilename = path.split('/').pop()?.replace('.json', '')
      return pathFilename === filename
    })

    if (!found) {
      throw new Error(`Mock file not found for ${filename}. Available paths: ${Object.keys(mockFileModules).join(', ')}`)
    }

    // 动态导入 JSON 文件
    const mockModule = await mockFileModules[found]()
    const mockData = (mockModule as { default?: unknown }).default || mockModule

    const newChat = chatManager.newChat()

    // 从 JSON 数据恢复属性，需要特殊处理 toolResults（Map 类型）
    const data = mockData as Record<string, unknown>
    const toolResultsData = (data.toolResults || {}) as Record<string, unknown>
    Object.assign(newChat, {
      ...data,
      toolResults: new Map(Object.entries(toolResultsData))
    })

    // 设置选中的 mock 文件
    selectedMockFile.value = filename

    console.log(`Mock file ${filename} loaded successfully`)
  } catch (error) {
    console.error(`Failed to load mock file ${filename}:`, error)
    throw error
  }
}

// 清空 mock 数据，回到正常模式
export function clearMockData(): void {
  if (!isDevelopment) {
    return
  }

  const chatManager = useChatManager()
  chatManager.clearChats()

  selectedMockFile.value = null
  console.log('Mock data cleared, back to normal mode')
}

// 设置选中的 mock 文件
export function setSelectedMockFile(filename: string | null): void {
  if (!isDevelopment) {
    return
  }

  if (filename === null) {
    clearMockData()
  } else {
    loadMockFile(filename).catch(console.error)
  }
}