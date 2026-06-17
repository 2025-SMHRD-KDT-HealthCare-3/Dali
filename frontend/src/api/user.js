import { api } from './client'

export const userApi = {
  getMe:           ()     => api.get('/users/me'),
  updateMe:        (data) => api.put('/users/me', data),
  updatePersona:   (persona) => api.patch('/users/me/persona', { persona }),
  deleteMe:        ()     => api.delete('/users/me'),
}
