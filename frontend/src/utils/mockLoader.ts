import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chat'

export const isDevelopment = import.meta.env.DEV

// 获取 .local/mocks 目录下的所有 JSON 文件
const mockFileModules = import.meta.glob('/.local/mocks/*.json')

export const mockFiles = (() => {
  const paths = Object.keys(mockFileModules)
  console.log('Raw glob paths:', paths)

  return paths.map(path => {
    // 提取文件名：从任意路径格式中提取纯文件名
    const filename = path.split('/').pop()?.replace('.json', '') || path
    console.log(`Processing path: "${path}" -> "${filename}"`)
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
    const chatStore = useChatStore()
    chatStore.clearAll()

    console.log(`Looking for mock file: "${filename}"`)
    console.log('Available paths:', Object.keys(mockFileModules))

    // 通过文件名查找对应的模块
    const found = Object.keys(mockFileModules).find(path => {
      const pathFilename = path.split('/').pop()?.replace('.json', '')
      return pathFilename === filename
    })

    if (!found) {
      throw new Error(`Mock file not found for ${filename}. Available paths: ${Object.keys(mockFileModules).join(', ')}`)
    }

    const mockData = await mockFileModules[found]()
    chatStore.loadFromJson(JSON.stringify(mockData))

    selectedMockFile.value = filename
    console.log(`Mock file ${filename} loaded successfully from ${found}`)
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

  const chatStore = useChatStore()
  chatStore.clearAll()
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