import { createRouter, createWebHistory } from 'vue-router'
import Onboarding from '../views/Onboarding.vue'
import WaitlistPage from '../views/WaitlistPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'app',
      component: Onboarding
    },
    {
      path: '/waitlist',
      name: 'waitlist',
      component: WaitlistPage
    }
  ]
})

export default router
