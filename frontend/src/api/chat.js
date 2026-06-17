import { api } from './client'

export const chatApi = {
  sendMessage: (body) => api.post('/chat', body),
}
