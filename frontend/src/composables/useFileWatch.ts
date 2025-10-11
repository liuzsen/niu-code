import { watch, onUnmounted } from 'vue'
import { useWorkspace } from '../stores/workspace'
import { apiService } from '../services/api'
import { fileUpdateService } from '../services/fileUpdates'
import { loadFileList, addFileToCache, removeFileFromCache } from '../components/suggestions/file-reference/config'
import { errorHandler } from '../services/errorHandler'

/**
 * 文件监听 Composable
 * 负责监听工作目录变化，加载文件列表并订阅文件更新
 */
export function useFileWatch() {
  const workspace = useWorkspace()

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
      if (!newDir) {
        return
      }

      // 初始加载文件列表
      const files = await apiService.getWorkspaceFiles(newDir)
      if (!files) {
        return
      }

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
          const appError = errorHandler.createNetworkError('无法实时更新文件列表')
          errorHandler.handle(appError)
        }
      })

      console.log('Subscribed to file updates for workDir:', newDir)
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
