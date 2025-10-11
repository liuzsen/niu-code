import type { Editor, Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Fuse from 'fuse.js'

// PluginKey 用于 TipTap Suggestion 插件
export const fileReferencePluginKey = new PluginKey("file-reference-suggestion")

export interface FileItem {
  path: string
  command: ({ editor, range }: { editor: Editor; range: Range }) => void
}

// 全局缓存文件列表和 Fuse 实例
let cachedFiles: string[] = []
let fuseInstance: Fuse<string> | null = null

function newFuse(files: string[]) {
  return new Fuse(files, {
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true,
    isCaseSensitive: false,
    minMatchCharLength: 2,
    findAllMatches: true,
    keys: [
      {
        name: 'path',
        weight: 0.3
      },
      {
        name: 'filename',
        weight: 0.7,
        getFn: (obj) => obj.split('/').pop() || ''
      }
    ],
    shouldSort: true
  })
}

/**
 * 加载文件列表到缓存
 */
export const loadFileList = async (files: string[]) => {
  cachedFiles = files
  fuseInstance = newFuse(files)
}

/**
 * 添加文件到缓存
 */
export const addFileToCache = (file: string) => {
  if (!cachedFiles.includes(file)) {
    cachedFiles.push(file)
    fuseInstance?.add(file)
  }
}

/**
 * 从缓存移除文件
 */
export const removeFileFromCache = (file: string) => {
  const index = cachedFiles.indexOf(file)
  if (index !== -1) {
    cachedFiles.splice(index, 1)
    fuseInstance?.remove((doc) => doc === file)
  }
}

/**
 * 转换文件路径为 FileItem
 */
const convertPathToFileItem = (path: string): FileItem => {
  return {
    path,
    command: ({ editor, range }) => {
      // 插入文件路径
      editor.chain().focus().deleteRange(range).insertContent("@" + path + ' ').run()
    }
  }
}

/**
 * 获取文件建议列表
 */
export const getFileReferenceItems = ({ query }: { query: string }): FileItem[] => {
  // 如果没有缓存的文件列表，返回空数组
  if (!cachedFiles.length) {
    return []
  }

  let filteredPaths: string[]

  // 如果没有查询，返回所有文件（最多10个）
  if (!query) {
    filteredPaths = cachedFiles.slice(0, 10)
  } else {
    // 使用 Fuse.js 进行模糊搜索
    if (!fuseInstance) {
      fuseInstance = newFuse(cachedFiles)
    }

    const results = fuseInstance.search(query)
    filteredPaths = results.map(result => result.item).slice(0, 10)
  }

  return filteredPaths.map(convertPathToFileItem)
}
