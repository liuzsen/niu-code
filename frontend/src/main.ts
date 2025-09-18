import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import './style.css'
import App from './App.vue'
import Aura from '@primeuix/themes/aura';
import { createPinia } from 'pinia'

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      cssLayer: {
        name: 'primevue',
        order: 'theme, base, primevue'
      },
      darkModeSelector: '.my-app-dark',
    }
  },
  dark: true
})
app.use(ToastService)

const pinia = createPinia()
app.use(pinia)
app.mount('#app')
