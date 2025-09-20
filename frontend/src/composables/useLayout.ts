import { computed, ref, onMounted } from "vue";


const appState = ref({
  primary: "emerald",
  surface: null,
  darkMode: true,
});

export function useLayout() {
  function toggleDarkMode() {
    appState.value.darkMode = !appState.value.darkMode;
    updateDarkModeClass();
  }

  function updateDarkModeClass() {
    if (appState.value.darkMode) {
      document.documentElement.classList.add("p-dark");
    } else {
      document.documentElement.classList.remove("p-dark");
    }
  }

  // Initialize dark mode on first load
  onMounted(() => {
    updateDarkModeClass();
  });

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
