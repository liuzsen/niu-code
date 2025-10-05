import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { usePrimeVue } from './usePrimeVue'
import router from './router'

const app = createApp(App)

usePrimeVue(app);
const pinia = createPinia()
app.use(pinia)
app.use(router)

app.mount('#app')
