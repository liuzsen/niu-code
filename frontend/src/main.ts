import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { usePrimeVue } from './usePrimeVue'

const app = createApp(App)

usePrimeVue(app);
const pinia = createPinia()
app.use(pinia)
app.mount('#app')
