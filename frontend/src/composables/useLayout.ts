import { computed } from "vue";
import { useTheme } from "../stores/theme";

/**
 * 布局相关的组合函数
 * 现在委托给 theme store 管理主题状态
 */
export function useLayout() {
  const themeStore = useTheme();

  function toggleDarkMode() {
    const newTheme = themeStore.currentTheme === 'dark' ? 'default-light' : 'dark';
    themeStore.setTheme(newTheme);
  }

  const isDarkMode = computed(() => themeStore.currentTheme === 'dark');

  return {
    isDarkMode,
    toggleDarkMode,
  };
}
