import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { usePrimeVue } from './usePrimeVue'
import { useChatStore } from './stores/chat'
import { initMessageManager } from './services/messageManager'
import { autoLoadMockData } from './utils/mockLoader'

const app = createApp(App)

usePrimeVue(app);
const pinia = createPinia()
app.use(pinia)

// 初始化聊天会话和消息管理器
const chatStore = useChatStore()
initMessageManager(chatStore)

// 提供 messageManager 给所有组件
import { messageManager } from './services/messageManager'
app.provide('messageManager', messageManager)

// 自动加载 mock 数据（如果在 mock 模式下）
autoLoadMockData().catch(console.error)

app.mount('#app')
