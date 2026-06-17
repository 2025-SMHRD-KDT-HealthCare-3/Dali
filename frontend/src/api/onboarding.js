import { api } from './client'

export const onboardingApi = {
  saveAnswer: (data) => api.post('/onboarding', data),
  getAnswers: ()     => api.get('/onboarding'),
}
