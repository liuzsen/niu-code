import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/**
 * 主题预设列表
 */
export const THEME_PRESETS = ['default-light', 'warm-light', 'cool-light', 'dark'] as const

/**
 * 主题预设类型
 */
export type ThemePreset = typeof THEME_PRESETS[number]

/**
 * 主题显示名称映射
 */
export const THEME_LABELS: Record<ThemePreset, string> = {
  'default-light': 'Default Light',
  'warm-light': 'Warm Light',
  'cool-light': 'Cool Light',
  'dark': 'Dark'
}

/**
 * 主题描述
 */
export const THEME_DESCRIPTIONS: Record<ThemePreset, string> = {
  'default-light': '中性灰色调，适合长时间工作',
  'warm-light': '温暖米黄色调，舒适氛围',
  'cool-light': '清爽青蓝色调，提升专注力',
  'dark': '深色主题，适合夜间使用'
}

const STORAGE_KEY = 'theme-preset'

/**
 * 主题管理 Store
 */
export const useTheme = defineStore('theme', () => {
  const currentTheme = ref<ThemePreset>('default-light')

  /**
   * 从 localStorage 加载主题设置
   */
  const loadTheme = () => {
    const storedTheme = localStorage.getItem(STORAGE_KEY)
    if (storedTheme && isValidTheme(storedTheme)) {
      currentTheme.value = storedTheme as ThemePreset
    }
  }

  /**
   * 验证主题值是否合法 (类型守卫)
   */
  const isValidTheme = (theme: string): theme is ThemePreset => {
    return THEME_PRESETS.includes(theme as ThemePreset)
  }

  /**
   * 应用主题到 DOM
   */
  const applyTheme = (theme: ThemePreset) => {
    const root = document.documentElement

    // 统一使用 data-theme 属性控制所有主题（包括 dark）
    root.setAttribute('data-theme', theme)

    currentTheme.value = theme
  }

  /**
   * 切换主题
   */
  const setTheme = (theme: ThemePreset) => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }

  /**
   * 初始化主题系统
   */
  const initialize = () => {
    loadTheme()
    applyTheme(currentTheme.value)
  }

  // 监听主题变化（用于调试或其他副作用）
  watch(currentTheme, (newTheme) => {
    console.log('[Theme] Theme changed to:', newTheme)
  })

  return {
    currentTheme,
    setTheme,
    initialize,
    THEME_LABELS,
    THEME_DESCRIPTIONS
  }
})
