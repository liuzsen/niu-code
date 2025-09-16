import { computed, ref } from "vue";


const appState = ref({
  primary: "emerald",
  surface: null,
  darkMode: false,
});

export function useLayout() {
  function toggleDarkMode() {
    appState.value.darkMode = !appState.value.darkMode;
    document.documentElement.classList.toggle("p-dark");
  }

  const isDarkMode = computed(() => appState.value.darkMode);
  const primary = computed(() => appState.value.primary);
  const surface = computed(() => appState.value.surface);

  return {
    isDarkMode,
    primary,
    surface,
    toggleDarkMode,
  };
}
