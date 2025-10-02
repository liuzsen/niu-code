
export interface DirectoryItem {
  name: string
  path: string
}

export interface DirectoryResponse {
  items: DirectoryItem[]
  currentPath: string
}

// Mock directory structure
const mockFileSystem: Record<string, DirectoryItem[]> = {
  '/': [
    { name: 'home', path: '/home' },
    { name: 'tmp', path: '/tmp' },
    { name: 'usr', path: '/usr' },
    { name: 'var', path: '/var' }
  ],
  '/home': [
    { name: 'sen', path: '/home/sen' },
    { name: 'user1', path: '/home/user1' },
    { name: 'user2', path: '/home/user2' }
  ],
  '/home/sen': [
    { name: 'code', path: '/home/sen/code' },
    { name: 'documents', path: '/home/sen/documents' },
    { name: 'downloads', path: '/home/sen/downloads' }
  ],
  '/home/sen/code': [
    { name: 'projects', path: '/home/sen/code/projects' },
    { name: 'work', path: '/home/sen/code/work' },
    { name: 'personal', path: '/home/sen/code/personal' }
  ],
  '/home/sen/code/projects': [
    { name: 'ai', path: '/home/sen/code/projects/ai' },
    { name: 'web', path: '/home/sen/code/projects/web' },
    { name: 'mobile', path: '/home/sen/code/projects/mobile' }
  ],
  '/home/sen/code/projects/ai': [
    { name: 'zsen-cc-web', path: '/home/sen/code/projects/ai/zsen-cc-web' },
    { name: 'ml-models', path: '/home/sen/code/projects/ai/ml-models' },
    { name: 'chatbot', path: '/home/sen/code/projects/ai/chatbot' }
  ],
  '/home/sen/code/projects/web': [
    { name: 'ecommerce', path: '/home/sen/code/projects/web/ecommerce' },
    { name: 'blog', path: '/home/sen/code/projects/web/blog' }
  ],
  '/home/sen/documents': [
    { name: 'notes', path: '/home/sen/documents/notes' }
  ],
  '/home/sen/downloads': [
    { name: 'images', path: '/home/sen/downloads/images' }
  ]
}

export class FileSystemService {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:33333') {
    this.baseUrl = baseUrl
  }

  async listDirectory(path: string): Promise<DirectoryResponse> {
    // Mock implementation for development - real implementation would use this.baseUrl
    console.log(`Using base URL: ${this.baseUrl}`)
    await new Promise(resolve => setTimeout(resolve, 200)) // Simulate network delay

    const normalizedPath = path.replace(/\/+$/, '') || '/'

    // Get items from mock file system
    const items = mockFileSystem[normalizedPath] || []

    // Add parent directory navigation if not at root
    if (normalizedPath !== '/') {
      const parentPath = normalizedPath.split('/').slice(0, -1).join('/') || '/'
      items.unshift({
        name: '..',
        path: parentPath
      })
    }

    return {
      items,
      currentPath: normalizedPath
    }
  }

  async validatePath(path: string): Promise<boolean> {
    // Mock implementation - check if path exists in our mock structure
    const normalizedPath = path.replace(/\/+$/, '') || '/'
    return !!mockFileSystem[normalizedPath]
  }

  async resolvePath(inputPath: string, currentPath: string): Promise<string> {
    // Handle path resolution (e.g., ../, ./, /)
    if (inputPath.startsWith('/')) {
      return inputPath
    }

    const currentDirs = currentPath.split('/').filter(Boolean)
    const inputDirs = inputPath.split('/').filter(Boolean)

    for (const dir of inputDirs) {
      if (dir === '..') {
        currentDirs.pop()
      } else if (dir !== '.') {
        currentDirs.push(dir)
      }
    }

    return '/' + currentDirs.join('/')
  }
}

// Default instance
export const fileSystemService = new FileSystemService()