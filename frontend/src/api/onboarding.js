import { api } from './client'

export const onboardingApi = {
  saveAll:    (data) => api.post('/onboarding', data),
  getAnswers: ()     => api.get('/onboarding/me'),
}
