import { createRouter, createWebHistory } from 'vue-router'
import Onboarding from '../views/Onboarding.vue'
import WaitlistPage from '../views/WaitlistPage.vue'
import ComplianceAssessment from '@/views/ComplianceAssessment.vue'

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
    },
    {
      path: '/assessment/new/:applicationId',
      name: 'assessment-new',
      component: ComplianceAssessment
    },
    {
      path: '/assessment/:assessmentId',
      name: 'assessment',
      component: ComplianceAssessment
    }
  ]
})

export default router
