import { createRouter, createWebHashHistory } from 'vue-router'
import Onboarding from '../views/Onboarding.vue'
import WaitlistPage from '../views/WaitlistPage.vue'
import ComplianceAssessment from '@/views/ComplianceAssessment.vue'

const router = createRouter({
  history: createWebHashHistory(),
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
    },
    {
      path: '/assessment/new/:applicationId',
      name: 'assessment-new',
      component: ComplianceAssessment
    }
  ]
})

export default router
