import { watch, onUnmounted } from 'vue'
import { useWorkspace } from '../stores/workspace'
import { useGlobalToast } from '../stores/toast'
import { apiService } from '../services/api'
import { fileUpdateService } from '../services/fileUpdates'
import { loadFileList, addFileToCache, removeFileFromCache } from '../components/file-reference/FileReferenceSuggestion'

/**
 * 文件监听 Composable
 * 负责监听工作目录变化，加载文件列表并订阅文件更新
 */
export function useFileWatch() {
  const workspace = useWorkspace()
  const toast = useGlobalToast()

  // 文件更新订阅管理
  let unsubscribeFileUpdates: (() => void) | null = null

  // 监听工作目录变化
  watch(
    () => workspace.workingDirectory,
    async (newDir) => {
      // 清理之前的订阅
      if (unsubscribeFileUpdates) {
        unsubscribeFileUpdates()
        unsubscribeFileUpdates = null
      }

      if (newDir) {
        try {
          // 初始加载文件列表
          const files = await apiService.getWorkspaceFiles(newDir)
          await loadFileList(files)
          console.log('File list loaded:', files.length, 'files')

          // 订阅文件更新
          unsubscribeFileUpdates = fileUpdateService.subscribe(newDir, {
            // 单个文件变更回调
            onFileChange: (type: 'created' | 'removed', file: string) => {
              try {
                console.log(`File ${type}:`, file)

                if (type === 'created') {
                  addFileToCache(file)
                } else if (type === 'removed') {
                  removeFileFromCache(file)
                }
              } catch (error) {
                console.error(`Failed to handle file ${type}:`, error)
              }
            },
            // 错误回调
            onError: (error: string) => {
              console.error('File update service error:', error)
              // 使用 toast 提示用户文件更新错误
              toast.add({
                severity: 'warn',
                summary: '文件更新错误',
                detail: `无法实时更新文件列表: ${error}`,
                life: 3000
              })
            }
          })

          console.log('Subscribed to file updates for workDir:', newDir)
        } catch (error) {
          console.error('Failed to load file list:', error)
        }
      }
    },
    { immediate: true }
  )

  // 组件卸载时清理订阅
  onUnmounted(() => {
    if (unsubscribeFileUpdates) {
      unsubscribeFileUpdates()
      unsubscribeFileUpdates = null
    }
  })

  return {
    // 可以导出文件列表等状态，如果需要的话
  }
}
