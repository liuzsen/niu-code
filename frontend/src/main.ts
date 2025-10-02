import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { usePrimeVue } from './usePrimeVue'
import { initMessageManager } from './services/messageManager'

const app = createApp(App)

usePrimeVue(app);
const pinia = createPinia()
app.use(pinia)

// 初始化消息管理器
initMessageManager()

// 提供 messageManager 给所有组件
import { messageManager } from './services/messageManager'
app.provide('messageManager', messageManager)

app.mount('#app')
