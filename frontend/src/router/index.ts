import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MainPage from '../view/MainPage.vue'
import SettingsPage from '../view/SettingsPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'main',
    component: MainPage
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage
  }
]

// 仅在开发环境中添加测试路由
if (import.meta.env.DEV) {
  routes.push({
    path: '/markdown-test',
    name: 'markdown-test',
    component: () => import('../view/MarkdownRendererTest.vue')
  })
  routes.push({
    path: '/diff-test',
    name: 'diff-test',
    component: () => import('../view/DiffViewerTest.vue')
  })
  routes.push({
    path: '/notification-test',
    name: 'notification-test',
    component: () => import('../view/NotificationTest.vue')
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
