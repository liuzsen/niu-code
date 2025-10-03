import { createRouter, createWebHistory } from 'vue-router'
import MainPage from '../view/MainPage.vue'
import SettingsPage from '../view/SettingsPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
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
})

export default router
