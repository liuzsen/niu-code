export interface RecentProject {
  name: string
  path: string
  lastOpened: number
}

const STORAGE_KEY = 'recent-projects'
const MAX_RECENT_PROJECTS = 10

export const recentProjectsStore = {
  get(): RecentProject[] {
    if (typeof window === 'undefined') return []

    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    try {
      const projects: RecentProject[] = JSON.parse(stored)
      return projects
        .sort((a, b) => b.lastOpened - a.lastOpened)
        .slice(0, MAX_RECENT_PROJECTS)
    } catch {
      return []
    }
  },

  add(path: string): RecentProject[] {
    if (typeof window === 'undefined') return []

    const projects = this.get()
    const projectName = path.split('/').pop() || path

    // Remove if already exists
    const filtered = projects.filter(p => p.path !== path)

    // Add new project
    const newProject: RecentProject = {
      name: projectName,
      path,
      lastOpened: Date.now()
    }

    const updated = [newProject, ...filtered].slice(0, MAX_RECENT_PROJECTS)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn('Failed to save recent projects to localStorage', e)
    }

    return updated
  },

  remove(path: string): RecentProject[] {
    if (typeof window === 'undefined') return []

    const projects = this.get()
    const filtered = projects.filter(p => p.path !== path)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    } catch (e) {
      console.warn('Failed to update recent projects in localStorage', e)
    }

    return filtered
  },

  clear(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('Failed to clear recent projects from localStorage', e)
    }
  }
}